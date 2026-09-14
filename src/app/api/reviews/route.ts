import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const isSummary = searchParams.get('summary') === 'true';

    const supabaseAdmin = createAdminClient();

    // 1. All tenants summary mode (used by discover and favorites pages)
    if (isSummary) {
      const { data: appts, error } = await supabaseAdmin
        .from('appointments')
        .select('tenant_id, custom_fields');

      if (error) throw error;

      const summaryMap: Record<string, { total: number; sum: number; average: number | null }> = {};

      appts?.forEach((a: any) => {
        const review = a.custom_fields?.review;
        if (review && typeof review.rating === 'number') {
          if (!summaryMap[a.tenant_id]) {
            summaryMap[a.tenant_id] = { total: 0, sum: 0, average: null };
          }
          summaryMap[a.tenant_id].total += 1;
          summaryMap[a.tenant_id].sum += review.rating;
        }
      });

      const result: Record<string, { average_rating: number | null; total_reviews: number }> = {};
      for (const [tId, val] of Object.entries(summaryMap)) {
        result[tId] = {
          total_reviews: val.total,
          average_rating: val.total > 0 ? Number((val.sum / val.total).toFixed(1)) : null,
        };
      }

      return NextResponse.json(result);
    }

    // 2. Specific tenant reviews mode
    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id parametresi gereklidir.' }, { status: 400 });
    }

    // Fetch tenant appointments with services
    const { data: appts, error } = await supabaseAdmin
      .from('appointments')
      .select('id, customer_id, start_time, status, custom_fields, services (name)')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: false });

    if (error) throw error;

    // Check current authenticated user
    const supabaseUser = await createServerClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    const reviews: Array<{
      appointment_id: string;
      customer_id: string | null;
      customer_name: string;
      avatar_url?: string;
      rating: number;
      comment: string;
      created_at: string;
      service_name?: string;
    }> = [];

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalScore = 0;
    let eligibleAppointmentId: string | null = null;
    let userHasReviewed = false;

    const now = new Date();

    appts?.forEach((a: any) => {
      const review = a.custom_fields?.review;
      const srvName = a.services?.name;

      // Extract existing review
      if (review && typeof review.rating === 'number') {
        const star = Math.min(Math.max(Math.round(review.rating), 1), 5);
        distribution[star] = (distribution[star] || 0) + 1;
        totalScore += review.rating;

        reviews.push({
          appointment_id: a.id,
          customer_id: a.customer_id,
          customer_name: review.customer_name || a.custom_fields?.customer_name || 'Müşteri',
          avatar_url: review.avatar_url || a.custom_fields?.avatar_url,
          rating: review.rating,
          comment: review.comment || '',
          created_at: review.created_at || a.start_time,
          service_name: srvName,
        });

        if (user && a.customer_id === user.id) {
          userHasReviewed = true;
        }
      }

      // Check if user is eligible to write a review (appointment past/completed)
      if (
        user &&
        a.customer_id === user.id &&
        !eligibleAppointmentId &&
        (a.status === 'completed' || (new Date(a.start_time) < now && a.status !== 'cancelled'))
      ) {
        eligibleAppointmentId = a.id;
      }
    });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : null;

    return NextResponse.json({
      reviews,
      total_reviews: totalReviews,
      average_rating: averageRating,
      distribution,
      eligible_appointment_id: eligibleAppointmentId,
      user_has_reviewed: userHasReviewed,
    });
  } catch (err: any) {
    console.error('Reviews GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUser = await createServerClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Yorum yapabilmek için giriş yapmalısınız.' }, { status: 401 });
    }

    const body = await req.json();
    const { appointment_id, rating, comment } = body;

    if (!appointment_id || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Geçersiz puan veya randevu seçimi (1-5 arası puan vermelisiniz).' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Check appointment
    const { data: appt, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, customer_id, tenant_id, status, start_time, custom_fields')
      .eq('id', appointment_id)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: 'Randevu bulunamadı.' }, { status: 404 });
    }

    // Verify ownership
    if (appt.customer_id !== user.id) {
      return NextResponse.json({ error: 'Sadece kendi randevunuza yorum yapabilirsiniz.' }, { status: 403 });
    }

    // Verify appointment status (completed or past)
    const isPast = new Date(appt.start_time) < new Date();
    if (appt.status === 'cancelled') {
      return NextResponse.json({ error: 'İptal edilmiş randevular değerlendirilemez.' }, { status: 400 });
    }

    if (appt.status !== 'completed' && !isPast) {
      return NextResponse.json({ error: 'Henüz gerçekleşmemiş randevular değerlendirilemez.' }, { status: 400 });
    }

    // Get user profile for name and avatar
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const customerName = profile?.full_name || appt.custom_fields?.customer_name || 'Müşteri';
    const customerAvatar = profile?.avatar_url || appt.custom_fields?.avatar_url || null;

    const reviewData = {
      rating: Math.round(rating),
      comment: (comment || '').trim(),
      created_at: new Date().toISOString(),
      customer_name: customerName,
      avatar_url: customerAvatar,
    };

    const updatedCustomFields = {
      ...(appt.custom_fields || {}),
      review: reviewData,
    };

    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        custom_fields: updatedCustomFields,
        // If not already marked completed, mark as completed
        status: appt.status === 'confirmed' && isPast ? 'completed' : appt.status,
      })
      .eq('id', appointment_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, review: reviewData });
  } catch (err: any) {
    console.error('Reviews POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
