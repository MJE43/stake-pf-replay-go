package scan

import "errors"

var (
	ErrGameNotFound = errors.New("game not found")
	ErrInvalidRange = errors.New("invalid nonce range")
	ErrTimeout      = errors.New("scan timed out")
)