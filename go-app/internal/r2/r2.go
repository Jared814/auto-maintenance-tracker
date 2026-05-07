// Package r2 wraps Cloudflare R2 object storage using the AWS S3-compatible API.
package r2

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	appconfig "github.com/jeg/auto-maintenance-tracker/internal/config"
)

// Client is a thin wrapper around the AWS S3 presign client pointed at
// Cloudflare R2.
type Client struct {
	s3client  *s3.Client
	presigner *s3.PresignClient
	bucket    string
	publicURL string
}

// NewClient creates an R2 Client from application config.
// Returns an error if the AWS SDK cannot be configured.
func NewClient(cfg *appconfig.Config) (*Client, error) {
	endpoint := fmt.Sprintf(
		"https://%s.r2.cloudflarestorage.com",
		cfg.CloudflareR2AccountID,
	)

	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.Background(),
		awsconfig.WithRegion("auto"),
		awsconfig.WithBaseEndpoint(endpoint),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				cfg.CloudflareR2AccessKeyID,
				cfg.CloudflareR2SecretAccessKey,
				"",
			),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("r2: load aws config: %w", err)
	}

	s3c := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		// Path-style addressing is required for Cloudflare R2.
		o.UsePathStyle = true
	})

	return &Client{
		s3client:  s3c,
		presigner: s3.NewPresignClient(s3c),
		bucket:    cfg.CloudflareR2BucketName,
		publicURL: cfg.CloudflareR2PublicURL,
	}, nil
}

// IsConfigured returns true when all required R2 environment variables are set.
func (c *Client) IsConfigured() bool {
	return c != nil &&
		c.bucket != "" &&
		c.publicURL != "" &&
		c.s3client != nil
}

// GenerateUploadURL returns a presigned PUT URL valid for 60 seconds, the
// public URL the object will be reachable at after upload, and the R2 key.
//
// Key format: receipts/{accountId}/{vehicleId}/{logId}_{timestamp}_{filename}
func (c *Client) GenerateUploadURL(
	ctx context.Context,
	accountId, vehicleId, logId, filename string,
) (uploadURL, publicURL, r2Key string, err error) {
	ts := time.Now().UnixMilli()
	r2Key = fmt.Sprintf("receipts/%s/%s/%s_%d_%s", accountId, vehicleId, logId, ts, filename)

	req, err := c.presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(r2Key),
	}, s3.WithPresignExpires(60*time.Second))
	if err != nil {
		return "", "", "", fmt.Errorf("r2: presign put object: %w", err)
	}

	uploadURL = req.URL
	publicURL = fmt.Sprintf("%s/%s", c.publicURL, r2Key)
	return uploadURL, publicURL, r2Key, nil
}

// DeleteObject removes an object from R2. Errors are logged by the caller;
// this is a best-effort cleanup.
func (c *Client) DeleteObject(ctx context.Context, r2Key string) error {
	_, err := c.s3client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(r2Key),
	})
	if err != nil {
		return fmt.Errorf("r2: delete object %q: %w", r2Key, err)
	}
	return nil
}
