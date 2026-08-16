export namespace discord {
	
	export class WebhookInfo {
	    id: string;
	    type: number;
	    guild_id?: string;
	    channel_id?: string;
	    name: string;
	    avatar?: string;
	    token: string;
	    application_id?: string;
	    latency_ms?: number;
	
	    static createFrom(source: any = {}) {
	        return new WebhookInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.guild_id = source["guild_id"];
	        this.channel_id = source["channel_id"];
	        this.name = source["name"];
	        this.avatar = source["avatar"];
	        this.token = source["token"];
	        this.application_id = source["application_id"];
	        this.latency_ms = source["latency_ms"];
	    }
	}

}

export namespace main {
	
	export class FileListResult {
	    files: storage.File[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new FileListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = this.convertValues(source["files"], storage.File);
	        this.total = source["total"];
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

export namespace storage {
	
	export class AppSettings {
	    webhook_url: string;
	    webhook_name?: string;
	    channel_id?: string;
	    guild_id?: string;
	    bot_token?: string;
	    master_key: string;
	    encryption_enabled: boolean;
	    chunk_size_bytes: number;
	    max_concurrency: number;
	    auto_launch_server: boolean;
	    server_port: number;
	    theme: string;
	    download_directory: string;
	    setup_completed: boolean;
	    webdav_enabled: boolean;
	    webdav_port: number;
	    s3_enabled: boolean;
	    s3_port: number;
	    cache_directory?: string;
	    max_cache_size_bytes: number;
	    prefetch_enabled: boolean;
	    deduplication_enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.webhook_url = source["webhook_url"];
	        this.webhook_name = source["webhook_name"];
	        this.channel_id = source["channel_id"];
	        this.guild_id = source["guild_id"];
	        this.bot_token = source["bot_token"];
	        this.master_key = source["master_key"];
	        this.encryption_enabled = source["encryption_enabled"];
	        this.chunk_size_bytes = source["chunk_size_bytes"];
	        this.max_concurrency = source["max_concurrency"];
	        this.auto_launch_server = source["auto_launch_server"];
	        this.server_port = source["server_port"];
	        this.theme = source["theme"];
	        this.download_directory = source["download_directory"];
	        this.setup_completed = source["setup_completed"];
	        this.webdav_enabled = source["webdav_enabled"];
	        this.webdav_port = source["webdav_port"];
	        this.s3_enabled = source["s3_enabled"];
	        this.s3_port = source["s3_port"];
	        this.cache_directory = source["cache_directory"];
	        this.max_cache_size_bytes = source["max_cache_size_bytes"];
	        this.prefetch_enabled = source["prefetch_enabled"];
	        this.deduplication_enabled = source["deduplication_enabled"];
	    }
	}
	export class Chunk {
	    id: string;
	    file_id: string;
	    chunk_index: number;
	    message_id: string;
	    attachment_id: string;
	    attachment_url: string;
	    proxy_url?: string;
	    size: number;
	    chunk_hash: string;
	    nonce?: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Chunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.file_id = source["file_id"];
	        this.chunk_index = source["chunk_index"];
	        this.message_id = source["message_id"];
	        this.attachment_id = source["attachment_id"];
	        this.attachment_url = source["attachment_url"];
	        this.proxy_url = source["proxy_url"];
	        this.size = source["size"];
	        this.chunk_hash = source["chunk_hash"];
	        this.nonce = source["nonce"];
	        this.created_at = this.convertValues(source["created_at"], null);
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
	export class File {
	    id: string;
	    folder_id?: string;
	    name: string;
	    size: number;
	    formatted_size?: string;
	    mime_type: string;
	    sha256: string;
	    is_encrypted: boolean;
	    chunk_count: number;
	    chunk_size: number;
	    favorite: boolean;
	    status: string;
	    tags?: string[];
	    thumbnail_url?: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    chunks?: Chunk[];
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.folder_id = source["folder_id"];
	        this.name = source["name"];
	        this.size = source["size"];
	        this.formatted_size = source["formatted_size"];
	        this.mime_type = source["mime_type"];
	        this.sha256 = source["sha256"];
	        this.is_encrypted = source["is_encrypted"];
	        this.chunk_count = source["chunk_count"];
	        this.chunk_size = source["chunk_size"];
	        this.favorite = source["favorite"];
	        this.status = source["status"];
	        this.tags = source["tags"];
	        this.thumbnail_url = source["thumbnail_url"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.chunks = this.convertValues(source["chunks"], Chunk);
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
	export class Folder {
	    id: string;
	    parent_id?: string;
	    name: string;
	    path: string;
	    color?: string;
	    icon?: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    file_count?: number;
	    total_size?: number;
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parent_id = source["parent_id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.color = source["color"];
	        this.icon = source["icon"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.file_count = source["file_count"];
	        this.total_size = source["total_size"];
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
	export class StorageStats {
	    total_files: number;
	    total_folders: number;
	    total_bytes: number;
	    formatted_total: string;
	    total_chunks: number;
	    category_counts: Record<string, number>;
	    category_bytes: Record<string, number>;
	    encrypted_files: number;
	    active_transfers: number;
	    deduplicated_bytes: number;
	    deduplicated_chunks: number;
	    active_shards: number;
	    total_shards: number;
	
	    static createFrom(source: any = {}) {
	        return new StorageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_files = source["total_files"];
	        this.total_folders = source["total_folders"];
	        this.total_bytes = source["total_bytes"];
	        this.formatted_total = source["formatted_total"];
	        this.total_chunks = source["total_chunks"];
	        this.category_counts = source["category_counts"];
	        this.category_bytes = source["category_bytes"];
	        this.encrypted_files = source["encrypted_files"];
	        this.active_transfers = source["active_transfers"];
	        this.deduplicated_bytes = source["deduplicated_bytes"];
	        this.deduplicated_chunks = source["deduplicated_chunks"];
	        this.active_shards = source["active_shards"];
	        this.total_shards = source["total_shards"];
	    }
	}
	export class SyncFolder {
	    id: string;
	    local_path: string;
	    remote_folder_id?: string;
	    enabled: boolean;
	    // Go type: time
	    last_sync_time: any;
	    sync_status: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new SyncFolder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.local_path = source["local_path"];
	        this.remote_folder_id = source["remote_folder_id"];
	        this.enabled = source["enabled"];
	        this.last_sync_time = this.convertValues(source["last_sync_time"], null);
	        this.sync_status = source["sync_status"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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
	export class Transfer {
	    id: string;
	    file_id: string;
	    filename: string;
	    type: string;
	    status: string;
	    total_bytes: number;
	    transferred_bytes: number;
	    progress_percent: number;
	    speed_bps: number;
	    speed_formatted?: string;
	    eta_seconds?: number;
	    chunks_total: number;
	    chunks_done: number;
	    error_message?: string;
	    local_path?: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Transfer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.file_id = source["file_id"];
	        this.filename = source["filename"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.total_bytes = source["total_bytes"];
	        this.transferred_bytes = source["transferred_bytes"];
	        this.progress_percent = source["progress_percent"];
	        this.speed_bps = source["speed_bps"];
	        this.speed_formatted = source["speed_formatted"];
	        this.eta_seconds = source["eta_seconds"];
	        this.chunks_total = source["chunks_total"];
	        this.chunks_done = source["chunks_done"];
	        this.error_message = source["error_message"];
	        this.local_path = source["local_path"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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
	export class WebhookShard {
	    id: string;
	    name: string;
	    url: string;
	    channel_id?: string;
	    guild_id?: string;
	    is_active: boolean;
	    priority: number;
	    // Go type: time
	    rate_limit_reset?: any;
	    error_count: number;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new WebhookShard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.channel_id = source["channel_id"];
	        this.guild_id = source["guild_id"];
	        this.is_active = source["is_active"];
	        this.priority = source["priority"];
	        this.rate_limit_reset = this.convertValues(source["rate_limit_reset"], null);
	        this.error_count = source["error_count"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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

