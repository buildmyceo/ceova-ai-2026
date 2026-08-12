import os
import json
import urllib.parse
from http.server import BaseHTTPRequestHandler
import yt_dlp
import requests

def verify_supabase_jwt(token):
    # In a full production app, verify the JWT properly.
    # For now, we will use the Supabase REST API to get the user context.
    supabase_url = os.environ.get("SUPABASE_DB_URL", "").replace("postgresql://", "https://").split(":")[0] 
    if not supabase_url:
        supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    }
    resp = requests.get(f"{supabase_url}/auth/v1/user", headers=headers)
    if resp.status_code == 200:
        return resp.json().get("id")
    return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._process()

    def do_POST(self):
        self._process()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()
        
    def _process(self):
        path = self.path
        parsed_path = urllib.parse.urlparse(path)
        query = urllib.parse.parse_qs(parsed_path.query)
        
        url = query.get('url', [None])[0]
        action = query.get('action', ['extract'])[0]
        
        if not url:
            self.send_error_response(400, "Missing 'url' parameter")
            return
            
        # Reject private IPs
        # yt-dlp has native safeguards, but we can enforce strict URL checks here.
        if "localhost" in url or "127.0.0.1" in url or "192.168." in url or "10." in url:
            self.send_error_response(400, "Local or private URLs are not permitted")
            return
            
        if action == 'extract':
            self.extract_metadata(url)
        elif action == 'download':
            self.download_video(url, query)
        else:
            self.send_error_response(400, "Invalid action")

    def extract_metadata(self, url):
        # Try yt-dlp first, fall back to YouTube oEmbed for YouTube URLs
        try:
            self._extract_with_ytdlp(url)
        except Exception as e:
            error_str = str(e)
            # YouTube bot detection — use oEmbed fallback
            if 'youtube' in url.lower() or 'youtu.be' in url.lower():
                self._youtube_oembed_fallback(url, error_str)
            else:
                self.send_error_response(500, error_str)

    def _youtube_oembed_fallback(self, url, original_error):
        """Use YouTube oEmbed API to get basic metadata without bot detection."""
        try:
            import urllib.request
            oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json"
            req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                oembed = json.loads(resp.read().decode())

            # Extract video ID for thumbnail
            video_id = None
            if 'youtu.be/' in url:
                video_id = url.split('youtu.be/')[1].split('?')[0]
            elif 'v=' in url:
                video_id = url.split('v=')[1].split('&')[0]

            thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else oembed.get('thumbnail_url')

            # Return standard quality list for YouTube (yt-dlp will handle actual format selection)
            qualities = [
                {'id': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]', 'label': '1080p', 'ext': 'mp4'},
                {'id': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]', 'label': '720p', 'ext': 'mp4'},
                {'id': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]', 'label': '480p', 'ext': 'mp4'},
                {'id': 'bestaudio/best', 'label': 'Audio Only', 'ext': 'm4a'},
            ]

            response_data = {
                "success": True,
                "title": oembed.get('title', 'YouTube Video'),
                "thumbnail": thumbnail,
                "duration": None,
                "provider": "YouTube",
                "qualities": qualities,
                "note": "Quality list is estimated (YouTube bot protection active)"
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())

        except Exception as e2:
            self.send_error_response(500, f"yt-dlp: {original_error} | oEmbed: {str(e2)}")

    def _extract_with_ytdlp(self, url):
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'socket_timeout': 15,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            formats = info.get('formats', [])

            seen_heights = set()
            video_qualities = []
            audio_quality = None

            for f in sorted(formats, key=lambda x: x.get('height') or 0, reverse=True):
                h = f.get('height')
                has_video = f.get('vcodec', 'none') != 'none'
                has_audio = f.get('acodec', 'none') != 'none'

                if not has_video and has_audio and audio_quality is None:
                    audio_quality = {'id': f['format_id'], 'label': 'Audio Only', 'ext': f.get('ext', 'm4a')}

                if has_video and h in [1080, 720, 480, 360] and h not in seen_heights:
                    seen_heights.add(h)
                    video_qualities.append({'id': f['format_id'], 'label': f'{h}p', 'ext': f.get('ext', 'mp4')})

            if not video_qualities and formats:
                best = next((f for f in reversed(formats) if f.get('vcodec', 'none') != 'none'), None)
                if best:
                    h = best.get('height') or 0
                    video_qualities.append({'id': best['format_id'], 'label': f'{h}p' if h else 'Best', 'ext': best.get('ext', 'mp4')})

            if audio_quality:
                video_qualities.append(audio_quality)
            else:
                video_qualities.append({'id': 'bestaudio', 'label': 'Audio Only', 'ext': 'm4a'})

            response_data = {
                "success": True,
                "title": info.get('title', 'Unknown Title'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration'),
                "provider": info.get('extractor_key', 'Video'),
                "qualities": video_qualities
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())

    def download_video(self, url, query):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith("Bearer "):
            self.send_error_response(401, "Missing or invalid Authorization header")
            return
            
        token = auth_header.split(" ")[1]
        user_id = verify_supabase_jwt(token)
        
        if not user_id:
            self.send_error_response(401, "Unauthorized")
            return
            
        format_id = query.get('format', ['best'])[0]
        output_format = query.get('output_format', ['mp4'])[0].lower()  # 'mp4' or 'mp3'
        is_audio_only = output_format == 'mp3'
        
        import uuid
        import time
        file_id = str(uuid.uuid4())
        timestamp = int(time.time())
        ext = 'mp3' if is_audio_only else 'mp4'
        filename = f"{timestamp}-{file_id}.{ext}"
        filepath = f"/tmp/{filename}"
        
        if is_audio_only:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': filepath,
                'quiet': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }
        else:
            ydl_opts = {
                'format': format_id if format_id != 'best' else 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'outtmpl': filepath,
                'quiet': True,
                'merge_output_format': 'mp4',
            }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                ydl.download([url])
                
            # Find the actual downloaded file (yt-dlp may change extension)
            actual_path = filepath
            if not os.path.exists(actual_path):
                for candidate in [f"/tmp/{timestamp}-{file_id}.mp3", f"/tmp/{timestamp}-{file_id}.mp4",
                                   f"/tmp/{timestamp}-{file_id}.webm", f"/tmp/{timestamp}-{file_id}.m4a"]:
                    if os.path.exists(candidate):
                        actual_path = candidate
                        filename = os.path.basename(candidate)
                        break
                
            # Upload to Supabase Storage
            supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
            service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
            
            if not supabase_url or not service_key:
                raise Exception("Server misconfiguration: Missing Supabase credentials")
                
            mime = "audio/mpeg" if is_audio_only else "video/mp4"
            storage_url = f"{supabase_url}/storage/v1/object/temp_videos/{user_id}/{filename}"
            
            with open(actual_path, 'rb') as f:
                upload_resp = requests.post(
                    storage_url,
                    headers={
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": mime
                    },
                    data=f
                )
                
            if upload_resp.status_code >= 400:
                raise Exception(f"Failed to upload to storage: {upload_resp.text}")
                
            # Generate signed URL
            signed_url_req = requests.post(
                f"{supabase_url}/storage/v1/object/sign/temp_videos/{user_id}/{filename}",
                headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
                json={"expiresIn": 1200} # 20 minutes
            )
            
            signed_url = None
            if signed_url_req.status_code == 200:
                signed_url = supabase_url + signed_url_req.json().get("signedURL", "")
                
            # Create library entry in public.files
            import datetime
            expires_at = (datetime.datetime.utcnow() + datetime.timedelta(minutes=20)).isoformat() + "Z"
            title = info.get("title", "Download")
            
            db_resp = requests.post(
                f"{supabase_url}/rest/v1/files",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json={
                    "user_id": user_id,
                    "storage_source": "video_downloader",
                    "name": f"{title}.{ext}",
                    "mime_type": mime,
                    "category": "audio" if is_audio_only else "videos",
                    "storage_path": f"{user_id}/{filename}",
                    "is_temporary": True,
                    "expires_at": expires_at
                }
            )
            
            library_item_id = None
            if db_resp.status_code < 300:
                items = db_resp.json()
                if items:
                    library_item_id = items[0].get("id")
            
            # Cleanup local file
            if os.path.exists(actual_path):
                os.remove(actual_path)
                
            response_data = {
                "success": True,
                "title": title,
                "format": ext,
                "thumbnail": info.get("thumbnail"),
                "libraryItemId": library_item_id,
                "signedUrl": signed_url,
                "expiresAt": expires_at
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_error_response(500, str(e))

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode())
