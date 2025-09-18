package scan

import "errors"

// Error definitions for the scan package
var (
	ErrGameNotFound  = errors.New("game not found")
	ErrInvalidSeed   = errors.New("invalid seed")
	ErrInvalidNonce  = errors.New("invalid nonce")
	ErrInvalidParams = errors.New("invalid params")
	ErrTimeout       = errors.New("timeout")
)