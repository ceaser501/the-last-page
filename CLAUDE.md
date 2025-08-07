# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "The Last Page" - a wedding memory gallery web application that displays photos and videos in a polaroid-style layout with decorative garland elements. The project is a static website with no build process, using vanilla JavaScript and Supabase for backend services.

## Key Architecture

### Modular JavaScript Design
- **script.js**: Core gallery logic with lazy loading and Supabase integration
- **detail-popup.js**: Modal popup system with slideshow, music player, and zoom controls
- **admin.js**: Admin interface for uploading and managing memories (login: ceaser501/0928)
- **dark-mode.js**: Theme switching with localStorage persistence
- **signup.js**: User registration form handling
- **style.css**: CSS custom properties for theming, polaroid effects, and responsive design

### Configuration and Data Flow
1. **External Configuration**: Loads from `https://lbjqzhqqxuqyvglslpne.supabase.co/storage/v1/object/public/public-config/config.js`
2. **Supabase Initialization**: Creates client using `window.SUPABASE_CONFIG`
3. **Lazy Loading**: Intersection Observer renders content in rows (7 photos for even rows, 5 for odd)
4. **Retry Logic**: Exponential backoff for Supabase operations to handle network issues

### Database Architecture (Supabase)
- **memories**: Main memory records with metadata
- **media_files**: Multiple images/videos per memory with ordering and main image flag
- **memory_music**: Background music with MP3 metadata and album covers

### File Naming Convention
Sequential naming: `{memoryId}_{fileNumber}.{ext}` (e.g., `1_001.jpg`, `1_002.jpg`)
Files sorted by this numbering system with main images (is_main=true) always first.

## Development Commands

This is a static website with no build process. To develop:

```bash
# Local development - serve files locally
python -m http.server 8000
# or
npx http-server
```

**Deploy**: Push to GitHub - hosted on GitHub Pages

## Key Data Structures

### Memory Object
```javascript
{
  id: number,
  title: string,
  thumbnail_title: string,
  description: string,
  date: string,
  location: string,
  tags: string,
  order: number,
  is_public: boolean,
  media_files: [
    {
      media_url: string,
      is_main: boolean,
      file_order: number
    }
  ],
  music: {
    music_title: string,
    artist_name: string,
    music_url: string,
    album_cover_url: string
  }
}
```

### Theme Implementation
CSS custom properties enable dynamic theme switching:
```css
:root { /* light theme variables */ }
[data-theme="dark"] { /* dark theme overrides */ }
```
Theme preference stored in localStorage and applied on page load.

## External Dependencies

- **Supabase**: `https://lbjqzhqqxuqyvglslpne.supabase.co` (database & storage)
- **jQuery 3.6.0**: DOM manipulation
- **Fancybox 5.0**: Lightbox (currently disabled)
- **Flatpickr**: Date picker
- **Daum Postcode API**: Korean address lookup
- **musicmetadata.js**: MP3 metadata extraction
- **Font Awesome 6.5.0**: Icons

## Important Considerations

1. **Language**: UI text and comments are in Korean
2. **Authentication**: Hardcoded admin credentials (ceaser501/0928) - not secure for production
3. **Client-side Security**: Supabase public key exposed, no server-side validation
4. **Video Processing**: Canvas-based thumbnail generation for video files
5. **Audio Integration**: Custom HTML5 audio player with seek controls and metadata display
6. **Performance**: Intersection Observer prevents loading all images simultaneously