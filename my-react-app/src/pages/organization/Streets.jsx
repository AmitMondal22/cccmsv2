import { OrgPage } from './OrgPage.jsx';
import { getStreets, createStreet, updateStreet, getWards } from '../../api/organization.api.js';
export default function Streets() {
  return (
    <OrgPage title="Streets" fetchFn={getStreets} createFn={createStreet} updateFn={updateStreet}
      parentLabel="Ward" parentFetchFn={getWards} parentKey="ward_id"
      columns={[
        { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
        { key: '_ward', label: 'Ward', dim: true, render: r => r.ward?.name || '—' },
        { key: 'status', label: 'Status', render: r => <span className={`badge badge-${r.status === 'active' ? 'online' : 'offline'}`}>{r.status}</span> },
      ]}
      formFields={[
        { key: 'name', label: 'Street / Area Name', required: true },
        { key: 'description', label: 'Description' },
      ]}
      defaultForm={{ ward_id: '', name: '', description: '' }}
    />
  );
}
