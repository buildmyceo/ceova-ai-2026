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
        self.handle_request()

    def do_POST(self):
        self.handle_request()
        
    def handle_request(self):
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
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Filter formats to meaningful ones (audio, 480p, 720p, 1080p)
                available_qualities = []
                formats = info.get('formats', [])
                
                for f in formats:
                    if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                        available_qualities.append({'id': f['format_id'], 'label': 'Audio Only', 'ext': f.get('ext')})
                    elif f.get('height') in [480, 720, 1080] and f.get('vcodec') != 'none':
                        available_qualities.append({'id': f['format_id'], 'label': f"{f['height']}p", 'ext': f.get('ext')})
                
                # Deduplicate formats
                seen = set()
                deduped = []
                for q in available_qualities:
                    if q['label'] not in seen:
                        seen.add(q['label'])
                        deduped.append(q)
                
                response_data = {
                    "success": True,
                    "title": info.get('title', 'Unknown Title'),
                    "thumbnail": info.get('thumbnail'),
                    "duration": info.get('duration'),
                    "provider": info.get('extractor_key'),
                    "qualities": deduped
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode())
                
        except Exception as e:
            self.send_error_response(500, str(e))

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
        
        import uuid
        import time
        file_id = str(uuid.uuid4())
        timestamp = int(time.time())
        filename = f"{timestamp}-{file_id}.mp4"
        filepath = f"/tmp/{filename}"
        
        ydl_opts = {
            'format': format_id,
            'outtmpl': filepath,
            'quiet': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                ydl.download([url])
                
            # Upload to Supabase Storage
            supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
            service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
            
            if not supabase_url or not service_key:
                raise Exception("Server misconfiguration: Missing Supabase credentials")
                
            storage_url = f"{supabase_url}/storage/v1/object/temp_videos/{user_id}/{filename}"
            
            with open(filepath, 'rb') as f:
                upload_resp = requests.post(
                    storage_url,
                    headers={
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": "video/mp4"
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
                    "name": info.get("title", filename) + f".{format_id}",
                    "mime_type": "video/mp4",
                    "category": "videos",
                    "storage_path": f"{user_id}/{filename}",
                    "is_temporary": True,
                    "expires_at": expires_at
                }
            )
            
            library_item_id = None
            if db_resp.status_code < 300:
                library_item_id = db_resp.json()[0].get("id")
            
            # Cleanup local file
            if os.path.exists(filepath):
                os.remove(filepath)
                
            # Return final payload
            response_data = {
                "success": True,
                "title": info.get("title", "Video"),
                "thumbnail": info.get("thumbnail"),
                "libraryItemId": library_item_id,
                "signedUrl": signed_url,
                "expiresAt": expires_at
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_error_response(500, str(e))

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode())
