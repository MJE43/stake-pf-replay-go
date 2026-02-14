package games

import (
	"reflect"
	"testing"
)

func TestKenoDraw_StakeVerify_Nonce1(t *testing.T) {
	seeds := Seeds{
		Server: "62571ad3a67f014963feb7578e1b4f56c9f2469bbde16cc0773af6803412490c",
		Client: "56e27fed-ece3-4279-ab56-96f71fe9b2ee",
	}

	nonce := uint64(1)

	g := &KenoGame{}
	draws0 := g.EvaluateDrawOnly(seeds, nonce)

	// Stake's verify UI shows 0-based draws, then "+ 1" for the final (1..40) display.
	want0 := []int{23, 0, 3, 14, 36, 27, 33, 22, 10, 5}
	if !reflect.DeepEqual(draws0, want0) {
		t.Fatalf("draw mismatch (0-based)\nwant: %#v\ngot:  %#v", want0, draws0)
	}

	// Also verify the +1 variant shown by Stake.
	draws1 := make([]int, len(draws0))
	for i, v := range draws0 {
		draws1[i] = v + 1
	}
	want1 := []int{24, 1, 4, 15, 37, 28, 34, 23, 11, 6}
	if !reflect.DeepEqual(draws1, want1) {
		t.Fatalf("draw mismatch (+1)\nwant: %#v\ngot:  %#v", want1, draws1)
	}

	t.Logf("draws (0-based): %v", draws0)
	t.Logf("draws (+1):     %v", draws1)
}
