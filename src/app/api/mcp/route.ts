import { NextRequest, NextResponse } from 'next/server';
import { mcpGateway } from '@/lib/mcp-client';

export async function GET() {
  try {
    await mcpGateway.connectAll();
    const tools = await mcpGateway.listTools();
    return NextResponse.json({ success: true, tools });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { server, tool, args } = await request.json();
    const result = await mcpGateway.callTool(server, tool, args);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
