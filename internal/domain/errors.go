package domain

// Stable error codes shared by every layer.
type Code string

const (
	CodeInvalidName          Code = "INVALID_NAME"
	CodeNotFound             Code = "NOT_FOUND"
	CodeFileConflict         Code = "FILE_CONFLICT"
	CodeInvalidParent        Code = "INVALID_PARENT"
	CodeInvalidHierarchy     Code = "INVALID_HIERARCHY"
	CodeFolderNotEmpty       Code = "FOLDER_NOT_EMPTY"
	CodeInvalidState         Code = "INVALID_STATE"
	CodeOperationUnavailable Code = "OPERATION_UNAVAILABLE"
	CodeDatabaseUnavailable  Code = "DATABASE_UNAVAILABLE"
	CodeInvalidConfig        Code = "INVALID_CONFIG"
)

// Error is a typed domain error with a stable Code and a safe Message.
// Message must never contain SQL, filesystem paths, or secret contents.
// Cause carries the optional internal detail for logs only; it is exposed
// via Unwrap and never via Error.
type Error struct {
	Code    Code
	Message string
	Cause   error
}

// New returns a domain Error with no internal cause.
func New(code Code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// Wrap returns a domain Error carrying an internal cause for Unwrap.
func Wrap(code Code, message string, cause error) *Error {
	return &Error{Code: code, Message: message, Cause: cause}
}

// Error implements error, returning only the safe message.
func (e *Error) Error() string { return e.Message }

// Unwrap returns the optional internal cause.
func (e *Error) Unwrap() error { return e.Cause }
