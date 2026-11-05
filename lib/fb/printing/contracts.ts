/** C1 transport/domain only. Hardware and local persistence belong to C2/C4. */
export const PRINT_PROTOCOL_VERSION=1;
export const PRINT_PAYLOAD_VERSION=1;
export const PRINT_RENDERER_VERSION=1;
export const PRINT_STATES=['queued','leased','dispatching','submitted','confirmed','retry_wait','blocked','ambiguous','expired','cancelled'] as const;
export type PrintState=typeof PRINT_STATES[number];
export const PRINT_CAPABILITIES=['printing.configure','printing.test','printing.reprint'] as const;
export const PRINT_RETENTION={metadataDays:180,privateMaxHours:24,pairingMinutes:5,credentialDays:90,leaseSeconds:60} as const;
export interface PrintEnvelope {
 job_id:string|null;kind?:'order'|'test'|'reprint'|'cancellation';state?:PrintState;revision?:number;fence?:number;attempt_id?:string;
 order_id?:string|null;group_id?:string|null;sector_id?:string|null;destination_id?:string;copy_number?:number;
 received?:boolean;dispatch_authorized?:boolean;dispatch_recorded?:boolean;lease_until?:string;expires_at?:string;
 protocol_version?:number;payload_version?:number;renderer_version?:number;
 snapshot?:Record<string,unknown>;snapshot_canonical?:string;snapshot_hash?:string;routing?:Record<string,unknown>;
 reprint?:boolean;duplicate_risk?:boolean;
 private?:{expired:boolean;expires_at?:string;room_label?:string;first_name?:string;last_name?:string;note?:string;line_notes?:{line_id:string;note:string}[]};
}
export const DEVICE_OPERATIONS=['exchange','heartbeat','claim','receipt','dispatch','result'] as const;
export type DeviceOperation=typeof DEVICE_OPERATIONS[number];
export const PRINT_RESULT_CODES=['spooler_accepted','transport_accepted','no_io','connection_unavailable','unknown_after_send'] as const;
