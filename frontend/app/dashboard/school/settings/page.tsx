'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const diplomas = ['Licence', 'Master 1', 'Master 2', 'Doctorat'];
type Requirement = { id: string; name: string; description?: string; type: string; diploma?: string; isRequired: boolean };
export default function SettingsPage() {
  const [diploma, setDiploma] = useState('Licence'); const [items, setItems] = useState<Requirement[]>([]); const [name, setName] = useState(''); const [required, setRequired] = useState(true);
  const load = () => apiClient.get(`/schools/me/requirements?diploma=${encodeURIComponent(diploma)}`).then(r => setItems(r.data.data ?? r.data ?? [])).catch(() => toast.error('Impossible de charger les prérequis'));
  useEffect(() => { load(); }, [diploma]);
  const add = async () => { if (!name.trim()) return toast.error('Le nom est obligatoire'); await apiClient.post('/schools/me/requirements', { name, diploma, isRequired: required }); setName(''); load(); toast.success('Prérequis ajouté'); };
  const archive = async (id: string) => { await apiClient.patch(`/schools/me/requirements/${id}`, { isActive: false }); load(); };
  return <div className="mx-auto max-w-3xl space-y-6"><div><h1 className="text-2xl font-bold">Paramètres admissions</h1><p className="text-sm text-muted-foreground">Configurez les pièces à demander selon le diplôme.</p></div><Card><CardHeader><CardTitle>Prérequis par diplôme</CardTitle></CardHeader><CardContent className="space-y-4"><div className="max-w-xs"><Label>Diplôme</Label><Select value={diploma} onValueChange={v => setDiploma(v ?? 'Licence')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{diplomas.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><div className="flex gap-2"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Copie CIN" /><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Obligatoire</label><Button onClick={add}>Ajouter</Button></div><div className="space-y-2">{items.map(x => <div className="flex items-center justify-between rounded border p-3" key={x.id}><span>{x.name} {x.isRequired && <b className="text-red-500">*</b>}</span><Button variant="ghost" className="text-red-600" onClick={() => archive(x.id)}>Archiver</Button></div>)}</div></CardContent></Card></div>;
}
