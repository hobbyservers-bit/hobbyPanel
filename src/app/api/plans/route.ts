import { NextResponse } from "next/server";
import plansConfig from "../../../../config/plans.json";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return NextResponse.json(plansConfig);
}
