package db

import "time"

const DueSoonMiles = 500
const DueSoonDays = 30

// CalculateMaintenanceStatus computes the maintenance status for a given log,
// maintenance type, and current mileage. Mirrors the TypeScript calculateMaintenanceStatus
// function in lib/maintenance-status.ts.
func CalculateMaintenanceStatus(
	log *MaintenanceLog,
	mtype *MaintenanceType,
	currentMileage *int64,
) MaintenanceStatusResult {
	if log == nil {
		return MaintenanceStatusResult{Status: StatusNeverServiced}
	}

	// Determine next due mileage.
	var nextDueMileage *int64
	if log.NextDueMileage.Valid {
		v := log.NextDueMileage.Int64
		nextDueMileage = &v
	} else if mtype != nil && mtype.DefaultIntervalMiles.Valid {
		v := log.MileageAtService + mtype.DefaultIntervalMiles.Int64
		nextDueMileage = &v
	}

	// Determine next due date.
	var nextDueDate *string
	if log.NextDueDate.Valid {
		v := log.NextDueDate.String
		nextDueDate = &v
	} else if mtype != nil && mtype.DefaultIntervalMonths.Valid {
		t, err := time.Parse(time.RFC3339, log.ServicedAt)
		if err == nil {
			v := t.AddDate(0, int(mtype.DefaultIntervalMonths.Int64), 0).Format(time.RFC3339)
			nextDueDate = &v
		}
	}

	if nextDueMileage == nil && nextDueDate == nil {
		return MaintenanceStatusResult{
			Status:             StatusUnknown,
			LastServiceDate:    log.ServicedAt,
			LastServiceMileage: log.MileageAtService,
		}
	}

	today := time.Now()
	isOverdue := false
	isDueSoon := false

	if nextDueMileage != nil && currentMileage != nil {
		if *currentMileage >= *nextDueMileage {
			isOverdue = true
		} else if *nextDueMileage-*currentMileage <= DueSoonMiles {
			isDueSoon = true
		}
	}

	if nextDueDate != nil {
		dueDate, err := time.Parse(time.RFC3339, *nextDueDate)
		if err == nil {
			daysUntilDue := int(dueDate.Sub(today).Hours() / 24)
			if daysUntilDue < 0 {
				isOverdue = true
			} else if daysUntilDue <= DueSoonDays {
				isDueSoon = true
			}
		}
	}

	status := StatusOK
	if isOverdue {
		status = StatusOverdue
	} else if isDueSoon {
		status = StatusDueSoon
	}

	return MaintenanceStatusResult{
		Status:             status,
		LastServiceDate:    log.ServicedAt,
		LastServiceMileage: log.MileageAtService,
		NextDueMileage:     nextDueMileage,
		NextDueDate:        nextDueDate,
	}
}

// StatusBadgeClass returns a Tailwind CSS class string for the given status badge.
func StatusBadgeClass(s MaintenanceStatus) string {
	switch s {
	case StatusOverdue:
		return "bg-red-100 text-red-800 border-red-200"
	case StatusDueSoon:
		return "bg-yellow-100 text-yellow-800 border-yellow-200"
	case StatusOK:
		return "bg-green-100 text-green-800 border-green-200"
	case StatusNeverServiced:
		return "bg-red-100 text-red-800 border-red-200"
	case StatusUnknown:
		return "bg-gray-100 text-gray-600 border-gray-200"
	default:
		return "bg-gray-100 text-gray-600 border-gray-200"
	}
}

// StatusLabel returns a human-readable label for the given status.
func StatusLabel(s MaintenanceStatus) string {
	switch s {
	case StatusOverdue:
		return "OVERDUE"
	case StatusDueSoon:
		return "DUE SOON"
	case StatusOK:
		return "OK"
	case StatusNeverServiced:
		return "NEVER SERVICED"
	case StatusUnknown:
		return "UNKNOWN"
	default:
		return "UNKNOWN"
	}
}
