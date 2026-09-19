import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveClubId(supabase: any, clubSlug: string): Promise<string | null> {
  const cleanSlug = decodeURIComponent(clubSlug).toLowerCase().trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSlug);

  if (isUuid) {
    const { data } = await supabase.from('clubs').select('id').eq('id', cleanSlug).maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: club } = await supabase.from('clubs').select('*').ilike('slug', cleanSlug).maybeSingle();
  if (club?.id) return club.id;

  const { data: allClubs } = await supabase.from('clubs').select('*');
  if (allClubs) {
    const matched = allClubs.find((c: any) =>
      c.slug?.toLowerCase() === cleanSlug ||
      (Array.isArray(c.previous_slugs) && c.previous_slugs.some((p: string) => p.toLowerCase() === cleanSlug)) ||
      (cleanSlug === 'apex-city-fc' && (c.slug === 'red-lions-fc' || c.short_name === 'RLFC'))
    );
    if (matched?.id) return matched.id;
  }

  return null;
}

// GET /api/clubs/[clubSlug]/members
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { clubSlug } = await context.params;
    const supabase = getServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase unconfigured' }, { status: 500 });
    }

    const clubId = await resolveClubId(supabase, clubSlug);
    if (!clubId) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const { data: members, error } = await supabase
      .from('members')
      .select('*')
      .eq('club_id', clubId)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Parse secondary_positions and roles from notes if present
    const parsedMembers = (members || []).map((m: any) => {
      let secondaryPositions: string[] = [];
      let roles: string[] = [];
      if (m.notes) {
        try {
          const parsed = JSON.parse(m.notes);
          if (Array.isArray(parsed.secondary_positions)) {
            secondaryPositions = parsed.secondary_positions;
          }
          if (Array.isArray(parsed.roles)) {
            roles = parsed.roles;
          }
        } catch (e) {
          // not JSON, ignore
        }
      }
      if (roles.length === 0 && m.role) {
        roles = m.role.split(',').map((r: string) => r.trim()).filter(Boolean);
      }
      return {
        ...m,
        full_name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Club Member',
        secondary_positions: secondaryPositions,
        roles: roles.length > 0 ? roles : [m.role || 'Player'],
      };
    });

    return NextResponse.json({ success: true, members: parsedMembers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clubs/[clubSlug]/members - Register a new member
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { clubSlug } = await context.params;
    const body = await request.json();
    const supabase = getServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase unconfigured' }, { status: 500 });
    }

    const clubId = await resolveClubId(supabase, clubSlug);
    if (!clubId) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const firstName = (body.first_name || '').trim();
    const lastName = (body.last_name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim();
    
    // Support multiple roles
    const roles: string[] = Array.isArray(body.roles) && body.roles.length > 0
      ? body.roles
      : (body.role ? [body.role] : ['Player']);
    const isPlayer = roles.some(r => r.toLowerCase() === 'player');
    const roleString = roles.join(', ');

    const position = isPlayer ? (body.player_position || body.position || null) : null;
    const secondaryPositions = isPlayer && Array.isArray(body.secondary_positions)
      ? body.secondary_positions.slice(0, 5)
      : [];
    const jerseyNumber = isPlayer && body.jersey_number ? Number(body.jersey_number) : null;
    const photoUrl = (body.photo_url || '').trim() || null;
    const isActive = body.status !== 'inactive' && body.is_active !== false;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const notesPayload = JSON.stringify({
      roles: roles,
      secondary_positions: secondaryPositions,
      executive_title: body.executive_title || null,
    });

    const insertPayload = {
      club_id: clubId,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      role: roleString,
      position: position,
      jersey_number: jerseyNumber,
      photo_url: photoUrl,
      is_active: isActive,
      membership_status: isActive ? 'approved' : 'inactive',
      notes: notesPayload,
    };

    const { data, error } = await supabase
      .from('members')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[API members POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: {
        ...data,
        full_name: `${data.first_name} ${data.last_name}`.trim(),
        roles: roles,
        secondary_positions: secondaryPositions,
      },
    });
  } catch (err: any) {
    console.error('[API members POST] Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to create member' }, { status: 500 });
  }
}

// PUT /api/clubs/[clubSlug]/members - Update an existing member
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { clubSlug } = await context.params;
    const body = await request.json();
    const supabase = getServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase unconfigured' }, { status: 500 });
    }

    const memberId = body.id;
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required for update' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.first_name !== undefined) updatePayload.first_name = body.first_name.trim();
    if (body.last_name !== undefined) updatePayload.last_name = body.last_name.trim();
    if (body.email !== undefined) updatePayload.email = body.email.trim().toLowerCase() || null;
    if (body.phone !== undefined) updatePayload.phone = body.phone.trim() || null;
    const roles: string[] | undefined = Array.isArray(body.roles)
      ? body.roles
      : (body.role ? [body.role] : undefined);

    if (roles) {
      updatePayload.role = roles.join(', ');
    } else if (body.role !== undefined) {
      updatePayload.role = body.role;
    }

    const isPlayer = roles
      ? roles.some((r: string) => r.toLowerCase() === 'player')
      : (body.role || '').toLowerCase().includes('player');

    if (isPlayer) {
      if (body.player_position !== undefined || body.position !== undefined) {
        updatePayload.position = body.player_position || body.position || null;
      }
      if (body.jersey_number !== undefined) {
        updatePayload.jersey_number = body.jersey_number ? Number(body.jersey_number) : null;
      }
    }

    if (body.secondary_positions !== undefined || roles !== undefined || body.executive_title !== undefined) {
      const existingNotes = body.notes || '{}';
      let parsedNotes: any = {};
      try {
        parsedNotes = typeof existingNotes === 'string' ? JSON.parse(existingNotes) : existingNotes;
      } catch (e) {
        parsedNotes = {};
      }
      if (roles) parsedNotes.roles = roles;
      if (body.secondary_positions !== undefined) {
        parsedNotes.secondary_positions = Array.isArray(body.secondary_positions) ? body.secondary_positions.slice(0, 5) : [];
      }
      if (body.executive_title !== undefined) {
        parsedNotes.executive_title = body.executive_title || null;
      }
      updatePayload.notes = JSON.stringify(parsedNotes);
    }

    const { data, error } = await supabase
      .from('members')
      .update(updatePayload)
      .eq('id', memberId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/clubs/[clubSlug]/members
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('id');
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase unconfigured' }, { status: 500 });
    }

    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Member deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete member' }, { status: 500 });
  }
}
