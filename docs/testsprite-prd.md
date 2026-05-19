# Canvascollab Whiteboard PRD

## Product Summary

Canvascollab is a browser-based collaborative whiteboard for fast visual planning. A user can draw, add structured objects, import images, annotate with text, and collaborate with another same-origin browser session without creating an account.

## Scope

The product is a single whiteboard workspace. It does not require persistent storage, user accounts, or server-side collaboration state. Collaboration is browser-to-browser on the same origin using local peer discovery and WebRTC data channels.

## Core Requirements

### 1. Whiteboard Loads Reliably

The app opens directly to the whiteboard and shows the primary drawing surface, tool controls, zoom controls, and collaboration status without requiring authentication.

Acceptance criteria:
- Visiting `/` renders the whiteboard.
- The page contains the main canvas area.
- The left toolbar and bottom zoom controls are visible.
- `/healthz` returns HTTP 200 with `{ "ok": true }`.

### 2. User Can Create Board Content

The user can add the common objects needed for a planning board: freehand strokes, rectangles, ellipses, and text.

Acceptance criteria:
- Selecting the pen tool and dragging creates a visible stroke.
- Selecting rectangle or ellipse and dragging creates the selected shape.
- Selecting text and clicking the board creates editable text.
- Clear removes created board content.

### 3. User Can Style And Arrange Objects

The user can change stroke color, fill color, and stroke size, then select and adjust objects on the board.

Acceptance criteria:
- Color controls update newly created shapes or strokes.
- Stroke-size controls change the size of new strokes.
- Select mode can select a shape or image.
- Selected objects can be moved, resized, brought forward, sent backward, or deleted.

### 4. User Can Import And Export Work

The user can bring an image into the board and export the current board as an image.

Acceptance criteria:
- Importing an image adds it to the whiteboard.
- The imported image is selectable and resizable.
- Export downloads a PNG representing the current board.

### 5. Same-Origin Collaboration Works Across Sessions

Two browser sessions on the same origin can discover each other, exchange board updates, and show remote presence.

Acceptance criteria:
- Opening the app in two tabs shows at least one remote collaborator indicator.
- Drawing in one tab appears in the other tab.
- Clearing the board in one tab clears it in the other tab.
- Remote cursor or presence state updates while both sessions are active.
