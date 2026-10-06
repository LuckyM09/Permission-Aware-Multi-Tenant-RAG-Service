# UI/UX Direction & Design System

## Project: VaultRAG — Permission-Aware Multi-Tenant RAG Service

---

### 1. Design Philosophy & Product Aesthetic

VaultRAG is an enterprise-grade security and document intelligence platform. Its design language communicates **rigor, transparency, and high trust**. 

Key design principles:
- **Security Made Visible**: Access controls and permission boundaries should not be invisible background mechanics. The UI actively communicates *why* a document is accessible or inaccessible through clear visual badges, citation pills, and the Access Explorer.
- **High-Information Density without Clutter**: Enterprise operators need rich data tables (Audit Logs, Document Registries) alongside clean, focused conversational workspaces.
- **Sophisticated Dark/Light Palette**: Defaulting to a deep, tailored slate/zinc dark mode with subtle glassmorphic card borders, crisp micro-typography, and purposeful semantic status colors.
- **Frictionless Demo Experience**: A persistent developer toolbar enables instantaneous switching between roles and tenants to visually demonstrate access boundaries during presentations.

---

### 2. Design System & Style Tokens

#### 2.1 Color Palette

```
/* Base Neutrals (Dark Theme Default) */
--background:        #090D16;   /* Deep abyss background */
--surface:           #0F172A;   /* Slate 900 card surface */
--surface-elevated:  #1E293B;   /* Slate 800 hover & modal surface */
--border:            #334155;   /* Slate 700 subtle border */
--border-subtle:     rgba(255, 255, 255, 0.08);

/* Typography */
--text-primary:      #F8FAFC;   /* Slate 50 high-contrast text */
--text-secondary:    #94A3B8;   /* Slate 400 muted text */
--text-tertiary:     #64748B;   /* Slate 500 disabled text */

/* Brand & Accent */
--primary:           #6366F1;   /* Indigo 500 primary brand */
--primary-hover:     #4F46E5;   /* Indigo 600 hover */
--primary-glow:      rgba(99, 102, 241, 0.25);

/* Semantic & Permission States */
--perm-tenant:       #38BDF8;   /* Sky 400 - Tenant-wide (Open) */
--perm-group:        #818CF8;   /* Indigo 400 - Group-restricted */
--perm-private:      #F59E0B;   /* Amber 500 - Owner only */
--status-ready:      #10B981;   /* Emerald 500 - Ready / Permitted */
--status-failed:     #EF4444;   /* Red 500 - Failed / Access Denied */
--status-processing: #3B82F6;   /* Blue 500 - Ingestion worker active */
```

#### 2.2 Typography
- **Primary Font**: `Geist Sans` or `Inter`, -apple-system, sans-serif.
- **Monospace Font**: `Geist Mono` or `JetBrains Mono` for UUIDs, chunk hashes, vectors, and SQL/code snippets.
- **Typographic Scale**:
  - `Display`: 28px / 36px line-height, Semi-Bold (Dashboard headings)
  - `Heading`: 20px / 28px line-height, Medium (Card titles, modal headers)
  - `Body`: 14px / 20px line-height, Regular (Chat messages, table cells)
  - `Small / Badge`: 12px / 16px line-height, Medium (Status pills, citation tags)
  - `Code / Meta`: 11px / 14px line-height, Regular (Timestamps, IP addresses, UUIDs)

---

### 3. Screen Layouts & Component Specifications

#### 3.1 Global Navigation & Dev Toolbar
```
+----------------------------------------------------------------------------------------------------+
| [VaultRAG Logo]  Tenant: [Acme Corp v]  | [DEV SWITCHER: (Alice - HR Admin) (Bob - Eng) (Eve - Ext)]|
+----------------------------------------------------------------------------------------------------+
| [Sidebar]       | [Main Content Area]                                                              |
| - Chat          |                                                                                  |
| - Documents     |                                                                                  |
| - Access Explore|                                                                                  |
| - Audit Logs    |                                                                                  |
| - Team & Groups |                                                                                  |
| - Settings      |                                                                                  |
+-----------------+----------------------------------------------------------------------------------+
```
- **Dev User Switcher**: A sticky banner in development mode that instantly swaps active session cookies between predefined personas:
  - `Alice` (Tenant A - HR Admin)
  - `Bob` (Tenant A - Engineering Member)
  - `Charlie` (Tenant A - Viewer)
  - `Mallory` (Tenant B - External Attacker)

---

#### 3.2 Screen 1: Chat Workspace (Split-Pane Architecture)

The Chat Workspace is split into three interactive zones:
1. **Left: Conversation Sidebar**: Historical threads, new chat button, search threads.
2. **Center: Conversational Stream**:
   - Streamed Markdown text with typing cursor.
   - Interactive Citation Badges rendered inline (e.g., `[Doc: Q4 Handbook #Chunk 2]`).
   - Grounding Confidence Indicator: *"Answer derived from 2 authorized documents."*
3. **Right: Citation & Source Inspector (Slide-Over Panel)**:
   - When a user clicks a citation badge, the right panel slides in displaying:
     - Document Name & Direct download link (if permitted).
     - Chunk Similarity Score (e.g., `0.89 cosine match`).
     - Complete chunk text snippet with highlighted keyword matches.
     - Document Access Policy badge (`Group: Human Resources`).

```
+-----------------------------------------------------------------------------------------------+
| History      | Chat Messages                                         | Source Inspector       |
| + New Chat   |                                                       |                        |
| - Salary Qs  | User: What are the senior engineering salary bands?   | [X] Close Inspector    |
| - Product FAQ|                                                       |                        |
| - HR Benefits| VaultRAG: Based on authorized internal documents:     | Document:              |
|              | The senior software engineer band is $180k-$220k [1]. | Q4_Salary_Bands.pdf    |
|              |                                                       | Visibility: [HR Group] |
|              | Sources:                                              | Similarity: 0.91       |
|              | [1] Q4_Salary_Bands.pdf (Chunk #3)                   |                        |
|              |                                                       | "Senior Staff Engineer |
|              | [ Ask another question...                       [Send]|  Band: $180,000 - ...  |
+-----------------------------------------------------------------------------------------------+
```

---

#### 3.3 Screen 2: Documents Hub

A central registry for file uploads and lifecycle management:
- **Header**: Search filter, upload button, filter by visibility (`All`, `Private`, `Group`, `Tenant`).
- **Drag-and-Drop Dropzone**: Supports `.pdf`, `.docx`, `.md`, `.txt` up to 25MB with upload progress ring.
- **Documents Table** (TanStack Table):
  - Columns: Title, Visibility Badge, Assigned Groups, Status (`Ready` with green pulse, `Processing` with spinner, `Failed`), Chunks Count, Uploaded Date, Actions (`Share`, `Re-index`, `Delete`).

```
+------------------------------------------------------------------------------------------------+
| Documents Hub                                                   [+ Upload New Document]        |
| Search: [ Filter documents... ]   Visibility: [ All Types v ]   Status: [ All v ]              |
+------------------------------------------------------------------------------------------------+
| Title                 | Visibility     | Groups           | Status    | Chunks | Date       |  |
|-----------------------+----------------+------------------+-----------+--------+------------+--|
| Engineering_Wiki.md   | [Tenant-wide]  | -                | [ Ready ] | 42     | 2 hrs ago  |..|
| Q4_Salary_Bands.pdf   | [Group Only]   | [HR] [Finance]   | [ Ready ] | 18     | Yesterday  |..|
| Internal_Merger.docx  | [Private]      | Owner Only       | [ Ready ] | 55     | 3 days ago |..|
| Malformed_Scan.pdf    | [Group Only]   | [Legal]          | [Failed]  | 0      | 4 days ago |..|
+------------------------------------------------------------------------------------------------+
```

---

#### 3.4 Screen 3: Share & Permissions Dialog

An intuitive modal launched from the Documents Hub or Viewer:
- **Visibility Options**:
  - `Private (Owner & Admin only)`: Restricted to the creator.
  - `Specific Groups`: Multi-select group tags with auto-complete.
  - `Tenant-Wide`: Accessible by all authenticated members of the tenant.
- **Permission Preview Alert**: Dynamically updates text: *"Only users in Human Resources and Finance (14 active members) will be able to retrieve answers from this document."*

---

#### 3.5 Screen 4: Access Explorer (Security Admin Showcase)

The primary administrative tool for demonstrating and inspecting permissions:
- **User Selector Bar**: Select any tenant member (e.g., `Bob - Engineering`).
- **Access Summary Cards**:
  - `Accessible Documents`: Count and percentage.
  - `Blocked Documents`: Count of inaccessible documents.
  - `Active Groups`: `['Engineering', 'Frontend-Team']`.
- **Comparative Dual Matrix**:
  - **Left Column: Accessible Documents (Green Status)**:
    - Lists documents Bob can retrieve with the exact rule granting access:
      - *Engineering_Wiki.md* -> `Granted via Tenant-Wide Policy`
      - *Architecture_RFC.pdf* -> `Granted via Engineering Group`
  - **Right Column: Inaccessible Documents (Red Status)**:
    - Lists documents Bob cannot retrieve with exact reason for denial:
      - *Q4_Salary_Bands.pdf* -> `Blocked: Requires 'Human Resources' or 'Finance'`
      - *Merger_Terms.docx* -> `Blocked: Private document owned by Alice`

---

#### 3.6 Screen 5: Audit Log Viewer

Compliance monitoring interface:
- **Filter Bar**: Date range picker, User selector, Action filter (`Query`, `Upload`, `Share`, `Revoke`, `Delete`).
- **Audit Table**:
  - Timestamp, User Name & Role, Action, Query Text, Retrieved Chunks (`2 chunks`), Denied Chunks (`4 chunks filtered`), Client IP.
- **Log Detail Modal**: Clicking a row opens a breakdown showing:
  - Query executed.
  - Chunks retrieved (with document IDs and similarity scores).
  - List of candidate documents that matched semantically but were rejected by the SQL permission filter.

---

### 4. Micro-Interactions & State Handling

1. **Streaming Token Cursor**:
   - As SSE tokens stream from the LLM, display a pulsing indigo cursor `|` with smooth opacity keyframes.
2. **Citation Hover Card**:
   - Hovering over `[Doc: Salary Bands]` reveals an instant glassmorphic preview tooltip showing document title, visibility tag, and a 2-line snippet without requiring a full panel click.
3. **Empty States**:
   - When no documents exist or a query produces 0 retrieved chunks, render clear contextual guidance: *"No documents were found that you have permission to view."*
4. **Optimistic UI with Rollback**:
   - When changing group permissions in the Share modal, update the UI badge immediately; if the API rejects the update, toast an error and revert the badge with a shake animation.
