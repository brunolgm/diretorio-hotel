'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { readTrimmedString } from '@/lib/form-utils';

export async function updateCurrentHotelSlugAction(form: FormData) {
 const { profile } = await requireAdminAccess('administrador');
 const previous = readTrimmedString(form,'expected_slug');
 const slug = readTrimmedString(form,'slug').toLowerCase();
 const client = await createClient();
 const result = await client.rpc('update_current_hotel_slug',{p_hotel_id:profile.hotel_id,p_expected_slug:previous,p_slug:slug});
 if(result.error) redirect('/admin/hotel/slug?error=1');
 revalidatePath('/admin/hotel');
 revalidatePath(`/hotel/${previous}`);
 revalidatePath(`/hotel/${slug}`);
 redirect('/admin/hotel?success=Slug%20atualizado%20com%20sucesso');
}