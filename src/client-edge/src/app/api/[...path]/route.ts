import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

async function handleProxy(request: NextRequest, pathSegments: string[]) {
  const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:7071';
  
  // Reconstruct the full path, filtering out empty segments to strip trailing slashes
  const path = pathSegments.filter(Boolean).join('/');
  
  // Extract query parameters
  const { search } = new URL(request.url);
  
  // Target URL on the backend
  const targetUrl = `${backendUrl}/api/${path}${search}`;

  console.log(`[Proxy Request] Incoming method: ${request.method} | Incoming URL: ${request.url} | Target URL: ${targetUrl}`);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Avoid forwarding host and connection headers which cause SSL/resolution issues
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
      headers.set(key, value);
    }
  });

  const method = request.method;
  let body: any = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.blob();
    } catch (e) {
      // Empty or invalid body
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`Failed to proxy request to ${targetUrl}:`, error);
    return NextResponse.json(
      { error: 'Proxy Error', message: error.message },
      { status: 502 }
    );
  }
}
