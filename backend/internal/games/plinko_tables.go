package games

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
)

//go:embed plinko_tables.json
var plinkoTablesJSON []byte

var plinkoPayoutTables = loadPlinkoTables()

func loadPlinkoTables() map[string]map[int][]float64 {
	raw := map[string]map[string][]float64{}
	if err := json.Unmarshal(plinkoTablesJSON, &raw); err != nil {
		panic(fmt.Sprintf("failed to parse plinko payout tables: %v", err))
	}

	result := make(map[string]map[int][]float64, len(raw))
	for risk, rows := range raw {
		if risk == "" {
			panic("encountered empty risk key in plinko tables")
		}

		result[risk] = make(map[int][]float64, len(rows))
		for rowsKey, multipliers := range rows {
			rowCount, err := strconv.Atoi(rowsKey)
			if err != nil {
				panic(fmt.Sprintf("invalid row key %q for risk %q: %v", rowsKey, risk, err))
			}

			expectedLength := rowCount + 1
			if len(multipliers) != expectedLength {
				panic(fmt.Sprintf("plinko table mismatch for risk %q rows %d: expected %d entries, got %d", risk, rowCount, expectedLength, len(multipliers)))
			}

			copied := make([]float64, expectedLength)
			copy(copied, multipliers)
			result[risk][rowCount] = copied
		}
	}

	return result
}

func plinkoTable(risk string, rows int) ([]float64, error) {
	riskTables, ok := plinkoPayoutTables[risk]
	if !ok {
		return nil, fmt.Errorf("unknown plinko risk: %s", risk)
	}

	table, ok := riskTables[rows]
	if !ok {
		return nil, fmt.Errorf("no payout table for risk %s rows %d", risk, rows)
	}

	return table, nil
}
