export namespace bindings {
	
	export class Hit {
	    Nonce: number;
	    Metric: number;
	
	    static createFrom(source: any = {}) {
	        return new Hit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Nonce = source["Nonce"];
	        this.Metric = source["Metric"];
	    }
	}
	export class Seeds {
	    Server: string;
	    Client: string;
	
	    static createFrom(source: any = {}) {
	        return new Seeds(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Server = source["Server"];
	        this.Client = source["Client"];
	    }
	}
	export class ScanRequest {
	    Game: string;
	    Seeds: Seeds;
	    NonceStart: number;
	    NonceEnd: number;
	    Params: Record<string, any>;
	    TargetOp: string;
	    TargetVal: number;
	    Tolerance: number;
	    Limit: number;
	    TimeoutMs: number;
	
	    static createFrom(source: any = {}) {
	        return new ScanRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Game = source["Game"];
	        this.Seeds = this.convertValues(source["Seeds"], Seeds);
	        this.NonceStart = source["NonceStart"];
	        this.NonceEnd = source["NonceEnd"];
	        this.Params = source["Params"];
	        this.TargetOp = source["TargetOp"];
	        this.TargetVal = source["TargetVal"];
	        this.Tolerance = source["Tolerance"];
	        this.Limit = source["Limit"];
	        this.TimeoutMs = source["TimeoutMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Summary {
	    Count: number;
	    Min: number;
	    Max: number;
	    Sum: number;
	    TotalEvaluated: number;
	
	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Count = source["Count"];
	        this.Min = source["Min"];
	        this.Max = source["Max"];
	        this.Sum = source["Sum"];
	        this.TotalEvaluated = source["TotalEvaluated"];
	    }
	}
	export class ScanResult {
	    RunID: string;
	    Hits: Hit[];
	    Summary: Summary;
	    EngineVersion: string;
	    Echo: ScanRequest;
	    TimedOut: boolean;
	    ServerSeedHash: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.RunID = source["RunID"];
	        this.Hits = this.convertValues(source["Hits"], Hit);
	        this.Summary = this.convertValues(source["Summary"], Summary);
	        this.EngineVersion = source["EngineVersion"];
	        this.Echo = this.convertValues(source["Echo"], ScanRequest);
	        this.TimedOut = source["TimedOut"];
	        this.ServerSeedHash = source["ServerSeedHash"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace games {
	
	export class GameSpec {
	    id: string;
	    name: string;
	    metric_label: string;
	
	    static createFrom(source: any = {}) {
	        return new GameSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.metric_label = source["metric_label"];
	    }
	}

}

