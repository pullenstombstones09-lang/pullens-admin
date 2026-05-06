'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { formatDate } from '@/lib/utils';
import type { EmployeeDocument, DocType } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Camera,
  ExternalLink,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';

interface DocumentsTabProps {
  employeeId: string;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  id_copy: 'ID Copy',
  contract: 'Employment Contract',
  eif: 'Employee Information Form',
  cv: 'CV / Resume',
  bank: 'Banking Confirmation',
  training: 'Training Certificate',
  ppe: 'PPE Acknowledgement',
  drivers: "Driver's Licence",
  prdp: 'PrDP',
  annexure_a: 'Annexure A',
  medical_cert: 'Medical Certificate',
  other: 'Other Document',
};

/* ─── ID / Passport Copy Section ─── */
function IdDocumentSection({ employeeId }: { employeeId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const canUpload = user?.role === 'owner' || user?.role === 'supervisor';
  const canDelete = user?.role === 'owner';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/staff/id-document?employeeId=${employeeId}`);
        const data = await res.json();
        if (data.url) {
          setIdDocUrl(data.url);
          setIsPdf(data.url.split('?')[0].endsWith('.pdf'));
        } else {
          setIdDocUrl(null);
        }
      } catch {
        setIdDocUrl(null);
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('error', 'File too large. Maximum 5MB.');
        return;
      }
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', employeeId);
      try {
        const res = await fetch('/api/staff/id-document', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) { toast('error', data.error || 'Upload failed'); return; }
        setIdDocUrl(data.url);
        setIsPdf(data.contentType === 'application/pdf');
        toast('success', 'ID document uploaded');
      } catch { toast('error', 'Upload failed'); }
      finally { setUploading(false); }
    };
    input.click();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this ID / passport copy? This cannot be undone.')) return;
    const res = await fetch(`/api/staff/id-document?employeeId=${employeeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast('error', data.error || 'Delete failed'); return; }
    setIdDocUrl(null);
    toast('success', 'ID document deleted');
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">ID / Passport Copy</h3>
        <div className="flex items-center gap-2">
          {canUpload && (
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors min-h-[48px]">
              <Upload className="h-4 w-4" />{idDocUrl ? 'Replace' : 'Upload'}
            </button>
          )}
          {canDelete && idDocUrl && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors min-h-[48px]">
              <Trash2 className="h-4 w-4" />Delete
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="animate-pulse h-32 rounded-lg bg-stone-100" />
      ) : idDocUrl ? (
        isPdf ? (
          <a href={idDocUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 hover:bg-stone-50 transition-colors">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1E40AF]/10">
              <FileText className="h-6 w-6 text-[#1E40AF]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">ID Document (PDF)</p>
              <p className="text-xs text-stone-500">Tap to view or download</p>
            </div>
            <Eye className="h-5 w-5 text-stone-400" />
          </a>
        ) : (
          <button onClick={() => window.open(idDocUrl, '_blank')}
            className="w-full rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
            <img src={idDocUrl} alt="ID / Passport copy" className="w-full max-h-64 object-contain bg-stone-50" />
            <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-stone-500">
              <Eye className="h-3.5 w-3.5" />Tap to view full size
            </div>
          </button>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border-2 border-dashed border-stone-200">
          <FileText className="h-10 w-10 text-stone-300 mb-2" />
          <p className="text-sm text-stone-500">No ID document on file</p>
          {canUpload && <p className="text-xs text-stone-400 mt-1">Upload a scan of the SA ID book, smart card, or passport</p>}
        </div>
      )}
    </Card>
  );
}

export default function DocumentsTab({ employeeId }: DocumentsTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    description: string
    variant: 'danger' | 'default'
    confirmLabel: string
    onConfirm: () => void
  } | null>(null);

  const loadDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('uploaded_at', { ascending: false });
    setDocs((data ?? []) as EmployeeDocument[]);
    setLoading(false);
  };

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleUpload = async (useCamera: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = useCamera ? 'image/*' : '.pdf,.jpg,.jpeg,.png,.doc,.docx';
    if (useCamera) input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Prompt for doc type
      const docType = window.prompt(
        'Document type:\n' +
        Object.entries(DOC_TYPE_LABELS).map(([k, v]) => `${k} = ${v}`).join('\n') +
        '\n\nEnter the key (e.g. id_copy):',
        'other'
      );
      if (!docType) return;

      const ext = file.name.split('.').pop();
      const path = `employees/${employeeId}/${docType}_${Date.now()}.${ext}`;

      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('path', path);

      const uploadRes = await fetch('/api/upload-file', { method: 'POST', body: uploadForm });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        toast('error', 'Upload failed: ' + (uploadData.error || 'Unknown error'));
        return;
      }

      const urlData = { publicUrl: uploadData.url };

      await supabase.from('employee_documents').insert({
        employee_id: employeeId,
        doc_type: docType,
        file_url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
      });

      loadDocs();
    };
    input.click();
  };

  const isExpiringSoon = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return diff < 30 * 86400000; // within 30 days
  };

  const isExpired = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    return new Date(expiryDate).getTime() < Date.now();
  };

  const handleDeleteDocument = (id: string) => {
    setConfirmModal({
      title: 'Delete Document',
      description: 'Delete this document? This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        const { error } = await supabase.from('employee_documents').delete().eq('id', id);
        if (error) {
          toast('error', 'Failed to delete document');
        } else {
          toast('success', 'Document deleted');
          setDocs((prev) => prev.filter((d) => d.id !== id));
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="flex justify-between">
                <div className="h-4 w-32 rounded bg-stone-200" />
                <div className="h-4 w-20 rounded bg-stone-200" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ID / Passport Copy — dedicated section */}
      <IdDocumentSection employeeId={employeeId} />

      <ConfirmationModal
        open={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => { confirmModal?.onConfirm(); }}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        variant={confirmModal?.variant ?? 'default'}
        confirmLabel={confirmModal?.confirmLabel ?? 'Confirm'}
      />
      {/* Upload buttons */}
      <div className="flex gap-3 mb-5">
        <Button variant="primary" size="md" onClick={() => handleUpload(true)} icon={<Camera className="h-4 w-4" />}>
          Camera
        </Button>
        <Button variant="secondary" size="md" onClick={() => handleUpload(false)} icon={<Upload className="h-4 w-4" />}>
          Upload File
        </Button>
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-stone-300 mb-3" />
          <p className="text-sm text-stone-500">No documents on file</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const expired = isExpired(doc.expiry_date);
            const expiring = !expired && isExpiringSoon(doc.expiry_date);

            return (
              <Card key={doc.id} padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <FileText className="h-5 w-5 text-stone-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {DOC_TYPE_LABELS[doc.doc_type as DocType] ?? doc.doc_type}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Uploaded {formatDate(doc.uploaded_at)}
                      </p>
                      {doc.expiry_date && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          Expires {formatDate(doc.expiry_date)}
                        </p>
                      )}
                      {doc.notes && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">{doc.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {expired && (
                      <Badge color="red">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                    {expiring && (
                      <Badge color="amber">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expiring
                      </Badge>
                    )}
                    <button
                      onClick={() => window.open(doc.file_url, '_blank')}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    {user?.role === 'owner' && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        title="Delete"
                        className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
