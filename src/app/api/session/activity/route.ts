import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

async function clearLocalSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("Unable to clear an expired Supabase session.", error.message);
    }
  } catch (error) {
    console.error("Unable to clear an expired Supabase session.", error);
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStoreHeaders });
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || typeof claims?.claims?.sub !== "string") {
    await clearLocalSession(supabase);
    return NextResponse.json(
      { error: "session-expired" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const { data: active, error } = await supabase.rpc("touch_app_session");

  if (error) {
    console.error("Unable to record current session activity.", error.message);
    return NextResponse.json(
      { error: "session-check-unavailable" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  if (!active) {
    try {
      const { error: revokeError } = await supabase.rpc("revoke_app_session");
      if (revokeError) {
        console.error("Unable to revoke an expired application session.", revokeError.message);
      }
    } catch (revokeError) {
      console.error("Unable to revoke an expired application session.", revokeError);
    }

    await clearLocalSession(supabase);
    return NextResponse.json(
      { error: "session-expired" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  return new NextResponse(null, { status: 204, headers: noStoreHeaders });
}
