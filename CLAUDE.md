# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "The Last Page" - a wedding memory gallery web application that displays photos and videos in a polaroid-style layout with decorative garland elements. The project is a static website with no build process, using vanilla JavaScript and Supabase for backend services.

## Key Architecture

### Frontend Structure
- **index.html**: Main gallery page with polaroid photo display
- **script.js**: Core gallery logic with lazy loading and Supabase integration
- **detail-popup.js**: Modal popup for viewing individual memories with slideshow
- **admin.js**: Admin interface for uploading and managing memories (login: ceaser501/0928)
- **style.css**: Polaroid effects, animations, and responsive design

### Data Flow
1. Configuration loaded from external Supabase storage
2. Media metadata fetched from Supabase database
3. Images/videos loaded from Supabase storage with lazy loading
4. Admin uploads go directly to Supabase storage and database

### External Dependencies
- Supabase (Database & Storage): `https://lbjqzhqqxuqyvglslpne.supabase.co`
- jQuery 3.6.0
- Fancybox 5.0 (lightbox)
- Flatpickr (date picker)
- Daum Postcode API (Korean addresses)

## Development Commands

This is a static website with no build process. To develop:

1. **Run locally**: Open `index.html` in a web browser or use a local server:
   ```bash
   python -m http.server 8000
   # or
   npx http-server
   ```

2. **Deploy**: Push to GitHub - the site appears to be hosted on GitHub Pages

## Key Patterns and Conventions

### Memory Data Structure
```javascript
{
  id: number,
  nickname: string,
  title: string,
  main_image_url: string,
  image_urls: string[], // Additional images
  tags: string[],
  date: string,
  location: string,
  music_title: string,
  music_url: string,
  is_public: boolean,
  display_order: number
}
```

### File Upload Pattern
- Multiple file selection supported
- Files uploaded to Supabase storage bucket 'wedding-memories'
- Automatic ordering based on drag-and-drop position
- Main image is the first in the list

### Lazy Loading Implementation
Uses Intersection Observer to load images as they come into viewport:
- Placeholder images shown initially
- Real images loaded when within 100px of viewport
- Prevents loading all images at once for performance

## Important Considerations

1. **Language**: UI text and comments are in Korean
2. **Authentication**: Simple hardcoded login for admin (not secure for production)
3. **Supabase Keys**: Currently using public anon key in client-side code
4. **Image Optimization**: No automatic image resizing - relies on Supabase transforms
5. **State Management**: No state management library - uses DOM directly