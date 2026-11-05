import 'server-only';
import {createClient} from '@/lib/supabase/server';
import {printRpc} from './rpc.server';
import {consoleArguments} from './admin-validation';
export {consoleArguments,validateConsoleCommand} from './admin-validation';
import type {PrintAccess,PrintConsole} from './admin';
export async function currentPrintAccess(){try{return await printRpc<PrintAccess>(await createClient(),'get_current_hotel_fb_print_access');}catch{return null;}}
export async function printingConsole(query=new URLSearchParams()){return printRpc<PrintConsole>(await createClient(),'get_current_hotel_fb_print_console',consoleArguments(query));}
