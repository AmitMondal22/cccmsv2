import { OrgPage } from './OrgPage.jsx';
import { getZones, createZone, updateZone, getCities } from '../../api/organization.api.js';
export default function Zones() {
  return (
    <OrgPage title="Zones" fetchFn={getZones} createFn={createZone} updateFn={updateZone}
      parentLabel="City" parentFetchFn={getCities} parentKey="city_id"
      columns={[
        { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
        { key: 'code', label: 'Code', dim: true },
        { key: '_city', label: 'City', dim: true, render: r => r.city?.name || '—' },
        { key: 'status', label: 'Status', render: r => <span className={`badge badge-${r.status === 'active' ? 'online' : 'offline'}`}>{r.status}</span> },
      ]}
      formFields={[
        { key: 'name', label: 'Zone Name', required: true },
        { key: 'code', label: 'Zone Code' },
        { key: 'description', label: 'Description' },
      ]}
      defaultForm={{ city_id: '', name: '', code: '', description: '' }}
    />
  );
}
