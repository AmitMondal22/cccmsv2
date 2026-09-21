import { OrgPage } from './OrgPage.jsx';
import { getWards, createWard, updateWard, getZones } from '../../api/organization.api.js';
export default function Wards() {
  return (
    <OrgPage title="Wards" fetchFn={getWards} createFn={createWard} updateFn={updateWard}
      parentLabel="Zone" parentFetchFn={getZones} parentKey="zone_id"
      columns={[
        { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
        { key: 'number', label: 'Number', dim: true },
        { key: '_zone', label: 'Zone', dim: true, render: r => r.zone?.name || '—' },
        { key: 'status', label: 'Status', render: r => <span className={`badge badge-${r.status === 'active' ? 'online' : 'offline'}`}>{r.status}</span> },
      ]}
      formFields={[
        { key: 'name', label: 'Ward Name', required: true },
        { key: 'number', label: 'Ward Number' },
        { key: 'description', label: 'Description' },
      ]}
      defaultForm={{ zone_id: '', name: '', number: '', description: '' }}
    />
  );
}
