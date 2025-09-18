package api

// Version information - these will be set at build time via ldflags
var (
	EngineVersion = "dev"
	GitCommit     = "unknown"
	BuildTime     = "unknown"
)

// GetVersionInfo returns the current version information
func GetVersionInfo() VersionInfo {
	return VersionInfo{
		EngineVersion: EngineVersion,
		GitCommit:     GitCommit,
		BuildTime:     BuildTime,
	}
}