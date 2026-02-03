# PDF Rendering & Text Highlighting Feature

## Overview

DataDash implements a sophisticated PDF rendering system that fetches contracts from remote sources (like S3 buckets), displays them in-browser, and intelligently highlights field values extracted from spreadsheet data. This document describes the architecture, implementation, and key features of this system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [S3 PDF Fetch Implementation](#s3-pdf-fetch-implementation)
3. [HTTP Proxy for CORS Bypass](#http-proxy-for-cors-bypass)
4. [Text Highlighting System](#text-highlighting-system)
5. [Error Handling & Fallbacks](#error-handling--fallbacks)
6. [Performance Optimizations](#performance-optimizations)
7. [Security Considerations](#security-considerations)

---

## Architecture Overview

The PDF rendering system consists of three main components:

```
┌─────────────────┐
│   ContractViewer│  (React Component)
│   - UI/UX       │
│   - Zoom/Search │
│   - Highlights  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   usePdfFetch   │  (Custom Hook)
│   - Fetch logic │
│   - CORS retry  │
│   - Cache mgmt  │
└────────┬────────┘
         │
         ├──────────→ Direct Fetch (CORS-enabled)
         │
         ↓
┌─────────────────┐
│ contract-proxy  │  (Supabase Edge Function)
│   - Host allow  │
│   - Size check  │
│   - Security    │
└─────────────────┘
         │
         ↓
┌─────────────────┐
│   S3 Bucket     │  (Remote Storage)
│   PDFs hosted   │
└─────────────────┘
```

---

## S3 PDF Fetch Implementation

### File Location
- **Hook**: `src/hooks/usePdfFetch.ts`
- **Config**: `src/config/proxyConfig.ts`

### How It Works

#### 1. PDF URL Detection

```typescript
export function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Check file extension
    if (pathname.endsWith('.pdf')) return true;

    // Check path or query params
    if (pathname.includes('.pdf') || urlObj.search.includes('.pdf')) return true;

    // Check S3 response-content-type header
    const responseContentType = urlObj.searchParams.get('response-content-type');
    if (responseContentType && isPdfContentType(responseContentType)) return true;

    return false;
  } catch {
    return false;
  }
}
```

This function identifies PDF URLs even when:
- Extension is `.pdf`
- S3 presigned URLs with PDF in the path
- S3 URLs with `response-content-type=application/pdf` parameter

#### 2. Direct Fetch Attempt

The system first tries to fetch the PDF directly from the source:

```typescript
const response = await fetch(source, {
  signal: abortControllerRef.current.signal,
  mode: 'cors',
  credentials: 'omit',
});
```

**Why This Matters:**
- Fastest method when CORS is enabled
- No intermediary server needed
- Direct connection to S3

#### 3. CORS Detection & Fallback

If direct fetch fails due to CORS:

```typescript
function isCorsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('cors') ||
    msg.includes('network request failed')
  );
}
```

The system automatically retries via the proxy:

```typescript
if (corsError && PROXY_CONFIG.enabled) {
  if (isProxyEnabledForHost(targetHostname)) {
    setState((prev) => ({ ...prev, fetchStatus: 'proxy_retry' }));
    const { blob, contentType, fileSize } = await fetchViaProxy(source, signal);
    // Continue with blob URL creation...
  }
}
```

#### 4. Caching Strategy

Successfully fetched PDFs are cached using IndexedDB:

```typescript
await contractCache.cacheContract(
  sheetName,
  rowIndex,
  source,
  blob,
  contentType || 'application/pdf'
);
```

Benefits:
- Instant load on revisit
- Reduces S3 bandwidth costs
- Works offline for cached documents
- Respects 10MB size limit

---

## HTTP Proxy for CORS Bypass

### File Location
- **Edge Function**: `supabase/functions/contract-proxy/index.ts`
- **Configuration**: `src/config/proxyConfig.ts`

### Why a Proxy?

S3 buckets often don't have CORS headers configured. Browsers block these requests for security. Our proxy acts as an intermediary that:
1. Fetches the PDF server-side (no CORS restrictions)
2. Adds proper CORS headers
3. Validates content before forwarding

### Proxy Architecture

```
Client                  Proxy                    S3
  │                      │                       │
  │──GET /proxy?url=───→│                       │
  │                      │──HEAD (validate)────→│
  │                      │←───200 OK─────────────│
  │                      │                       │
  │                      │──GET (fetch PDF)────→│
  │                      │←───PDF bytes──────────│
  │                      │                       │
  │                      │ [Validate size,       │
  │                      │  content type,        │
  │                      │  signature]           │
  │                      │                       │
  │←───PDF + CORS────────│                       │
```

### Security Features

#### 1. Host Allowlist

Only approved hosts can be proxied:

```typescript
const ALLOWED_HOSTS = [
  "app-myautobots-public-dev.s3.amazonaws.com",
];

function isHostAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some((allowed) => {
    if (allowed.startsWith("*.")) {
      const suffix = allowed.slice(1);
      return hostname.endsWith(suffix) || hostname === allowed.slice(2);
    }
    return hostname === allowed;
  });
}
```

**Why:** Prevents proxy abuse for arbitrary URLs.

#### 2. Private Network Protection

```typescript
const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./, /^0\./, /^169\.254\./,
  /^::1$/, /^fc00:/i, /^fe80:/i,
];

function isPrivateNetwork(hostname: string): boolean {
  if (hostname === "localhost") return true;
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) return true;
  }
  return false;
}
```

**Why:** Prevents SSRF attacks targeting internal networks.

#### 3. Size Limits

```typescript
const MAX_CONTRACT_BYTES = 10 * 1024 * 1024; // 10MB

// Check declared size first
if (declaredSize && declaredSize > MAX_CONTRACT_BYTES) {
  return errorResponse('file_too_large',
    `File size ${(declaredSize / 1024 / 1024).toFixed(1)} MB exceeds limit`);
}

// Monitor streaming size
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  totalBytes += value.length;
  if (totalBytes > MAX_CONTRACT_BYTES) {
    reader.cancel();
    return errorResponse('file_too_large',
      `File exceeds size limit of ${MAX_CONTRACT_BYTES / 1024 / 1024} MB`);
  }
  chunks.push(value);
}
```

**Why:** Prevents memory exhaustion and DoS attacks.

#### 4. Content Type Validation

```typescript
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/octet-stream",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function isPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return PDF_MAGIC_BYTES.every((b, i) => bytes[i] === b);
}
```

**Why:** Validates file type by signature, not just extension.

#### 5. Timeout Protection

```typescript
const FETCH_TIMEOUT_MS = 30000;

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

const response = await fetch(targetUrl.toString(), {
  signal: controller.signal,
  headers: { "User-Agent": "DataDash-ContractProxy/1.0" },
});

clearTimeout(timeoutId);
```

**Why:** Prevents hanging requests from tying up resources.

### CORS Headers

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Applied to all responses
return new Response(body, {
  status: 200,
  headers: {
    ...corsHeaders,
    "Content-Type": contentType,
    "Content-Length": totalLength.toString(),
    "Cache-Control": "no-store",
    "X-Proxy-File-Size": totalLength.toString(),
  },
});
```

---

## Text Highlighting System

### File Location
- **Component**: `src/components/ContractViewer.tsx` (lines 189-376)
- **Utils**: `src/utils/highlightColors.ts`

### How It Works

#### 1. Field Value Extraction

When a PDF is loaded, the system extracts field values from the current spreadsheet row:

```typescript
const fieldHighlights = useMemo(() => {
  if (!headers || !currentRow) return [];
  return prepareFieldHighlights(headers, currentRow, 2);
}, [headers, currentRow]);
```

`prepareFieldHighlights` creates an array of `FieldHighlight` objects:

```typescript
interface FieldHighlight {
  fieldName: string;
  value: string;
  color: {
    name: string;      // Group ID
    bg: string;        // Background color
    border: string;    // Border color
  };
  occurrences: number;
}
```

#### 2. Text Layer Traversal

Once the PDF renders, the system walks the DOM tree to find text nodes:

```typescript
const textLayers = document.querySelectorAll('.textLayer, .react-pdf__Page__textContent');

textLayers.forEach((layer) => {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT, null);
  const textNodes: { node: Node; parent: HTMLElement }[] = [];

  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && !node.parentElement.classList.contains('field-highlight')) {
      textNodes.push({ node, parent: node.parentElement });
      fullExtractedText += (node.textContent || '') + ' ';
    }
  }

  // Process each text node...
});
```

**Why TreeWalker?**
- Efficient DOM traversal
- Captures all text nodes regardless of nesting
- Skips already-highlighted nodes

#### 3. Pattern Matching & Injection

For each text node, the system searches for field values:

```typescript
textNodes.forEach(({ node, parent }) => {
  const text = node.textContent || '';
  let newHTML = text;
  let hasMatch = false;

  updatedHighlights.forEach((highlight, idx) => {
    // Escape special regex characters
    const escapedValue = highlight.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedValue})`, 'gi');
    const matches = newHTML.match(regex);

    if (matches) {
      hasMatch = true;
      updatedHighlights[idx].occurrences += matches.length;
      const groupId = highlight.color.name;

      // Wrap matches with styled spans
      newHTML = newHTML.replace(
        regex,
        `<span class="field-highlight"
               data-field="${highlight.fieldName}"
               data-group="${groupId}"
               data-term="${encodeURIComponent(highlight.value)}"
               style="background-color: ${highlight.color.bg};
                      border-bottom: 2px solid ${highlight.color.border};
                      padding: 1px 2px;
                      border-radius: 2px;
                      cursor: pointer;">$1</span>`
      );
    }
  });

  if (hasMatch) {
    parent.innerHTML = newHTML;
  }
});
```

**Features:**
- Case-insensitive matching (`gi` flag)
- Tracks occurrence count per field
- Color-coded by field group
- Clickable for interactions

#### 4. Interactive Highlights

Each highlight is clickable and shows contextual actions:

```typescript
document.querySelectorAll('.field-highlight').forEach((el) => {
  el.addEventListener('click', handleHighlightClick as EventListener);
});

const handleHighlightClick = useCallback((e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const fieldName = target.dataset.field;
  const groupId = target.dataset.group;
  const encodedTerm = target.dataset.term;

  if (fieldName && encodedTerm && groupId) {
    const term = decodeURIComponent(encodedTerm);
    const rect = target.getBoundingClientRect();

    // Show action bubble
    setActiveBubble({
      fieldName,
      term,
      occurrences: field?.occurrences || 1,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      groupId,
    });

    // Filter to show only this term
    setHighlightFilter({ mode: 'term', term, fieldName, groupId });
  }
}, [highlightedFields, highlightFilter]);
```

#### 5. Field Legend

A floating legend shows all highlighted fields:

```typescript
<div className="fixed right-6 top-40 z-40 w-64 bg-white rounded-lg shadow-lg">
  <div className="px-3 py-2 bg-slate-50">
    <span className="text-xs font-semibold">Field Legend</span>
  </div>
  <div className="max-h-80 overflow-auto p-2">
    {highlightedFields.filter(f => f.occurrences > 0).map((field) => (
      <div
        key={field.fieldName}
        onClick={() => handleLegendGroupClick(field.color.name)}
        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-100"
      >
        <span
          className="w-3 h-3 rounded-sm"
          style={{
            backgroundColor: field.color.bg,
            border: `2px solid ${field.color.border}`
          }}
        />
        <span className="flex-1 truncate">{formatFieldName(field.fieldName)}</span>
        <span className="text-slate-400">{field.occurrences}</span>
        {isComplete && <Check className="w-3.5 h-3.5 text-green-600" />}
      </div>
    ))}
  </div>
</div>
```

#### 6. Filter Modes

The highlighting system supports three filter modes:

**Mode 1: All (default)**
```typescript
{ mode: 'all' }
```
All highlights visible.

**Mode 2: Legend Group Filter**
```typescript
{ mode: 'legendGroup', groupId: 'blue' }
```
Only highlights from one color group visible (e.g., all "Address" fields).

**Mode 3: Specific Term Filter**
```typescript
{ mode: 'term', term: '123 Main St', fieldName: 'PropertyAddress', groupId: 'blue' }
```
Only instances of a specific value visible.

Filtering is applied via opacity:

```typescript
useEffect(() => {
  const highlights = document.querySelectorAll('.field-highlight');

  highlights.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const elGroup = htmlEl.dataset.group;
    const elTerm = htmlEl.dataset.term ? decodeURIComponent(htmlEl.dataset.term) : '';
    const elField = htmlEl.dataset.field;

    let isVisible = true;

    if (highlightFilter.mode === 'legendGroup') {
      isVisible = elGroup === highlightFilter.groupId;
    } else if (highlightFilter.mode === 'term') {
      isVisible = elTerm === highlightFilter.term && elField === highlightFilter.fieldName;
    }

    htmlEl.style.opacity = isVisible ? '1' : '0.15';
    htmlEl.style.pointerEvents = isVisible ? 'auto' : 'none';
  });
}, [highlightFilter, highlightedFields]);
```

#### 7. Mark as Done

When a user verifies a field, they can mark it complete:

```typescript
const handleMarkAsDone = useCallback((fieldName: string, closeBubble = true) => {
  if (onFieldStatusChange) {
    const currentStatus = fieldStatuses?.[fieldName];
    if (currentStatus === 'complete') {
      onFieldStatusChange(fieldName, 'incomplete');
    } else {
      onFieldStatusChange(fieldName, 'complete');
    }
  }
  setActiveTooltip(null);
  if (closeBubble) {
    setActiveBubble(null);
  }
}, [onFieldStatusChange, fieldStatuses]);
```

Keyboard shortcut:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!activeBubble) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkAsDone(activeBubble.fieldName, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveBubble(null);
      setHighlightFilter({ mode: 'all' });
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [activeBubble, handleMarkAsDone]);
```

---

## Error Handling & Fallbacks

### Error Classification System

The system classifies errors for better user guidance:

```typescript
export type ContractErrorCode =
  | 'cors_blocked'
  | 'network_error'
  | 'not_pdf'
  | 'invalid_response'
  | 'pdf_parse_error'
  | 'timeout'
  | 'http_error'
  | 'file_too_large'
  | 'host_not_allowed'
  | 'blocked_private_network'
  | 'invalid_url'
  | 'not_supported_type'
  | 'proxy_failed';
```

### Failure Categories

```typescript
export type ContractFailureCategory =
  | 'user_actionable'          // User can fix (bad URL, etc.)
  | 'transient_network'         // Temporary network issue
  | 'cors_restriction'          // CORS not configured
  | 'server_unavailable'        // Remote server down
  | 'file_corrupted'            // Malformed PDF
  | 'size_exceeds_limit'        // File too large
  | 'security_blocked'          // Proxy security rules
  | 'unknown';                  // Catch-all
```

### Manual Upload Fallback

If all else fails, users can upload the PDF manually:

```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || file.type !== 'application/pdf') {
    alert('Please select a valid PDF file');
    return;
  }

  const url = URL.createObjectURL(file);
  setManualPdfUrl(url);
  setPdfParseError(false);
};
```

This creates a local blob URL that bypasses all network issues.

---

## Performance Optimizations

### 1. Debounced Highlight Application

Highlights are applied 200ms after PDF render completes:

```typescript
setTimeout(() => {
  const textLayers = document.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
  // Apply highlights...
}, 200);
```

**Why:** Ensures PDF.js has fully rendered text layers.

### 2. Memoized Field Extraction

```typescript
const fieldHighlights = useMemo(() => {
  if (!headers || !currentRow) return [];
  return prepareFieldHighlights(headers, currentRow, 2);
}, [headers, currentRow]);
```

**Why:** Prevents re-computation on every render.

### 3. IndexedDB Caching

```typescript
const cached = await contractCache.getCachedContract(sheetName, rowIndex, source);
if (cached) {
  const url = URL.createObjectURL(cached.blob);
  objectUrlRef.current = url;
  setState({
    pdfUrl: url,
    isLoading: false,
    isCached: true,
    fileSize: cached.size,
    contentType: cached.contentType,
    fetchStatus: 'success',
  });
  return;
}
```

**Why:** Instant loads for previously viewed PDFs.

### 4. Cleanup on Unmount

```typescript
const cleanupObjectUrl = useCallback(() => {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }
}, []);

useEffect(() => {
  fetchPdf();
  return () => {
    cleanupObjectUrl();
    abortControllerRef.current?.abort();
  };
}, [fetchPdf, cleanupObjectUrl]);
```

**Why:** Prevents memory leaks from blob URLs and pending requests.

---

## Security Considerations

### 1. Host Allowlist

Only specific S3 buckets can be proxied. This prevents:
- Open proxy abuse
- Bandwidth theft
- DDoS reflection attacks

### 2. Size Limits

10MB cap prevents:
- Memory exhaustion
- Bandwidth abuse
- DoS attacks

### 3. Private Network Blocking

Prevents SSRF attacks targeting:
- Internal services (127.0.0.1, 192.168.x.x)
- Cloud metadata endpoints (169.254.169.254)
- Private network ranges

### 4. Content Validation

Magic byte checking prevents:
- Malicious file execution
- MIME type confusion attacks

### 5. Timeout Protection

30-second timeout prevents:
- Resource exhaustion
- Slowloris-style attacks

### 6. No Credential Forwarding

```typescript
const response = await fetch(source, {
  mode: 'cors',
  credentials: 'omit',  // Never send cookies
});
```

Prevents credential theft via malicious PDFs.

---

## Usage Example

### Basic Integration

```tsx
import { ContractViewer } from './components/ContractViewer';

function App() {
  const [contractUrl, setContractUrl] = useState(
    'https://app-myautobots-public-dev.s3.amazonaws.com/contract-123.pdf'
  );

  return (
    <ContractViewer
      source={contractUrl}
      onContractChange={setContractUrl}
      sheetName="Contracts"
      rowIndex={0}
      headers={['ContractID', 'PropertyAddress', 'SalePrice']}
      currentRow={{
        ContractID: '123',
        PropertyAddress: '123 Main St',
        SalePrice: '500000',
      }}
      fieldStatuses={{}}
      onFieldStatusChange={(field, status) => console.log(field, status)}
      onContractLoadError={(error) => console.error('Load failed:', error)}
    />
  );
}
```

---

## Future Enhancements

### Planned Features
- [ ] OCR integration for scanned PDFs
- [ ] Multi-language support for non-English documents
- [ ] Export highlighted PDF with annotations
- [ ] Bulk PDF processing/validation
- [ ] Machine learning for field extraction confidence
- [ ] Fuzzy matching for slight variations in field values

### Performance
- [ ] Web Workers for highlight computation
- [ ] Virtual scrolling for large PDFs
- [ ] Progressive loading (render page-by-page)
- [ ] Pre-caching adjacent documents

### UX Improvements
- [ ] Highlight heatmap showing field density
- [ ] Side-by-side comparison of two contracts
- [ ] Annotation tools (notes, markers)
- [ ] Collaborative review (multi-user)

---

## Troubleshooting

### PDF Won't Load

1. **Check URL format**: Must be valid HTTP/HTTPS URL
2. **Verify host allowlist**: Add domain to `ALLOWED_HOSTS` in proxy config
3. **Check file size**: Must be under 10MB
4. **Test direct access**: Try opening URL in new tab

### Highlights Not Showing

1. **Verify field values**: Must have actual data in spreadsheet
2. **Check text layer**: PDF must have selectable text (not scanned image)
3. **Enable debug mode**: Add `?debug=1` to URL to see diagnostic info

### Slow Performance

1. **Clear cache**: Large cache can slow down IndexedDB
2. **Reduce zoom level**: Lower scale = faster rendering
3. **Disable highlights**: Toggle off if not needed for review

---

## Technical Specifications

| Feature | Specification |
|---------|--------------|
| Max PDF Size | 10 MB |
| Fetch Timeout | 30 seconds |
| Cache Storage | IndexedDB (per-browser limit) |
| Supported Formats | PDF, JPEG, PNG, GIF, WebP, DOC, DOCX |
| Browser Support | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Highlight Colors | 20 distinct color groups |
| Concurrent Highlights | Unlimited (performance depends on PDF size) |

---

## Contributing

When modifying this feature:

1. **Update allowlist**: Add new hosts to `PROXY_CONFIG.allowedHosts`
2. **Test CORS**: Verify both direct and proxy fetch paths
3. **Validate security**: Ensure no bypass of allowlist/size checks
4. **Check performance**: Profile with large PDFs (8-10MB)
5. **Update docs**: Keep this file in sync with implementation

---

## License

This feature is part of DataDash and is licensed under the MIT License.
