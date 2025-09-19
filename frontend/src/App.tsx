import { useState, useEffect } from 'react';
import './App.css';
import { StartScan } from '../wailsjs/go/bindings/App';
import { bindings } from '../wailsjs/go/models';

function App() {
    const [resultText, setResultText] = useState("Ready to scan.");
    const [formValues, setFormValues] = useState<bindings.ScanRequest>(new bindings.ScanRequest({
        Game: 'limbo',
        Seeds: new bindings.Seeds({ Server: '', Client: '' }),
        NonceStart: 1,
        NonceEnd: 1000,
        Params: {},
        TargetOp: 'ge',
        TargetVal: 10.0,
        Tolerance: 1e-9,
        Limit: 100,
        TimeoutMs: 60000,
    }));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const newValues = { ...formValues };

        if (name === 'Server' || name === 'Client') {
            newValues.Seeds = new bindings.Seeds({ ...newValues.Seeds, [name]: value });
        } else {
            (newValues as any)[name] = value;
        }
        setFormValues(new bindings.ScanRequest(newValues));
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setResultText('Scanning...');
        try {
            const result = await StartScan(formValues);
            setResultText(`Scan complete! Found ${result.Hits.length} hits. Run ID: ${result.RunID}`);
            console.log(result);
        } catch (error) {
            setResultText(`Error: ${error}`);
        }
    }

    return (
        <div id="App">
            <h1>Stake PF Replay</h1>
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="Server">Server Seed</label>
                    <input type="text" id="Server" name="Server" value={formValues.Seeds.Server} onChange={handleInputChange} required />
                </div>
                <div className="input-group">
                    <label htmlFor="Client">Client Seed</label>
                    <input type="text" id="Client" name="Client" value={formValues.Seeds.Client} onChange={handleInputChange} required />
                </div>
                <div className="input-group">
                    <label htmlFor="Game">Game</label>
                    <select id="Game" name="Game" value={formValues.Game} onChange={handleInputChange}>
                        <option value="limbo">Limbo</option>
                        <option value="dice">Dice</option>
                        <option value="roulette">Roulette</option>
                        <option value="pump">Pump</option>
                    </select>
                </div>
                <div className="input-group">
                    <label htmlFor="NonceStart">Nonce Start</label>
                    <input type="number" id="NonceStart" name="NonceStart" value={formValues.NonceStart} onChange={handleInputChange} />
                </div>
                <div className="input-group">
                    <label htmlFor="NonceEnd">Nonce End</label>
                    <input type="number" id="NonceEnd" name="NonceEnd" value={formValues.NonceEnd} onChange={handleInputChange} />
                </div>
                <div className="input-group">
                    <label htmlFor="TargetOp">Target Operator</label>
                    <select id="TargetOp" name="TargetOp" value={formValues.TargetOp} onChange={handleInputChange}>
                        <option value="ge">&gt;=</option>
                        <option value="gt">&gt;</option>
                        <option value="eq">==</option>
                        <option value="le">&lt;=</option>
                        <option value="lt">&lt;</option>
                    </select>
                </div>
                <div className="input-group">
                    <label htmlFor="TargetVal">Target Value</label>
                    <input type="number" step="any" id="TargetVal" name="TargetVal" value={formValues.TargetVal} onChange={handleInputChange} />
                </div>
                <button type="submit" className="btn">Start Scan</button>
            </form>
            <div id="result" className="result">{resultText}</div>
        </div>
    );
}

export default App;