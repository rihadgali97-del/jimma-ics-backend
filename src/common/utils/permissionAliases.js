const accessAliases = {
  'mosque.create': ['mosques.write'],
  'mosque.edit': ['mosques.write'],
  'mosque.grant_approve': ['mosques.write'],
  'mosque.delete': ['mosques.write'],
  'madrasa.accredit': ['madrasas.write'],
  'student.manage': ['madrasas.write'],
  'hifz.record_progress': ['madrasas.write'],
  'teacher.manage': ['madrasas.write'],
  'attendance.submit': ['madrasas.write'],
  'ulema.license': ['fatwas.write'],
  'fatwa.publish': ['fatwas.write'],
  'finance.record_entry': ['finance.write'],
  'finance.approve_l1': ['finance.write'],
  'finance.approve_l2': ['finance.write'],
  'zakat.disburse': ['zakat.manage'],
  'services.process': ['janazah.manage', 'zakat.manage'],
  'events.schedule': ['events.write'],
  'documents.publish': ['documents.write'],
  'gateway.send_sabaq': ['broadcast.send'],
  'gateway.send_janazah': ['broadcast.send'],
  'gateway.mass_broadcast': ['broadcast.send'],
  'gateway.topup': ['broadcast.send'],
};

export function expandPermissionAliases(permissions = []) {
  const expanded = new Set(permissions);
  for (const permission of permissions) {
    for (const alias of accessAliases[permission] || []) expanded.add(alias);
  }
  return [...expanded];
}
