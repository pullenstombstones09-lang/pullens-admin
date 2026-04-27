'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
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

export default function DocumentsTab({ employeeId }: DocumentsTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    const { error } = await supabase.from('employee_documents').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete document');
    } else {
      toast('success', 'Document deleted');
      setDocs((prev) => prev.filter((d) => d.id !== id));
    }
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
    <div>
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
                      <p className="text-sm font-medium text-[#1A1A2E] truncate">
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
                    {user?.role === 'head_admin' && (
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
