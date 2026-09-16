import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';

export default function FileUpload() {
    const { session } = useAuth();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [filesList, setFilesList] = useState([]);

    useEffect(() => {
        if (session?.user) {
            fetchUserFiles();
        }
    }, [session]);

    const fetchUserFiles = async () => {
        try {
            if (!session?.user) return;
            const { data, error } = await supabase.storage
                .from('user-files')
                .list(session.user.id, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) throw error;
            setFilesList(data || []);
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    const uploadFile = async (fileToUpload) => {
        if (!session?.user) {
            return { error: new Error('User not logged in.') };
        }

        try {
            const userId = session.user.id;
            const filePath = `${userId}/${fileToUpload.name}`;

            const { data, error } = await supabase.storage
                .from('user-files')
                .upload(filePath, fileToUpload, {
                    cacheControl: '3600',
                    upsert: true 
                });

            if (error) {
                return { error };
            }

            console.log("Upload success:", data);
            return { data };
        } catch (err) {
            console.error("Upload exception:", err);
            return { error: err };
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file to upload first.');
            return;
        }

        setUploading(true);
        setMessage('');

        const { data, error } = await uploadFile(file);

        if (error) {
            setMessage(`Upload failed: ${error.message}`);
            console.error("Upload failed:", error);
        } else {
            setMessage('File uploaded successfully! ✅');
            setFile(null); 
            document.getElementById('file-input').value = ''; 
            fetchUserFiles(); 
        }

        setUploading(false);
    };

    const downloadFile = async (fileName) => {
        if (!session?.user) {
            console.error('Not logged in');
            return;
        }

        try {
            const filePath = `${session.user.id}/${fileName}`;
            const { data, error } = await supabase.storage
                .from('user-files')
                .download(filePath);

            if (error) {
                console.error("Download error:", error);
                setMessage(`Download failed: ${error.message}`);
                return;
            }

            console.log("Download success:", data);
            
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (err) {
            console.error("Download exception:", err);
            setMessage(`Download failed: ${err.message}`);
        }
    };

    return (
        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '16px', color: 'white' }}>Secure File Storage</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input 
                    id="file-input"
                    type="file" 
                    onChange={(e) => setFile(e.target.files[0])} 
                    style={{ color: '#ccc' }}
                />
                
                <button 
                    onClick={handleUpload} 
                    disabled={uploading || !file}
                    style={{
                        padding: '10px 20px',
                        background: uploading || !file ? '#444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: uploading || !file ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        width: 'fit-content'
                    }}
                >
                    {uploading ? 'Uploading...' : 'Upload File'}
                </button>

                {message && (
                    <div style={{ color: message.includes('failed') ? '#ef4444' : '#10b981', fontSize: '0.9rem' }}>
                        {message}
                    </div>
                )}
            </div>

            <div style={{ marginTop: '32px' }}>
                <h4 style={{ color: 'white', marginBottom: '12px' }}>Your Files</h4>
                {filesList.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>No files uploaded yet.</p>
                ) : (
                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filesList.map((f, idx) => (
                            <li key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#ddd' }}>{f.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{(f.metadata?.size / 1024).toFixed(1)} KB</span>
                                </div>
                                <button 
                                    onClick={() => downloadFile(f.name)}
                                    style={{
                                        padding: '6px 12px',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Download
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
