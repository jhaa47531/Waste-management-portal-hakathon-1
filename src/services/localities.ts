/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Locality } from '../types/index.ts';

/**
 * Initial municipal localities matching public.localities table in 05_seed_data.sql.
 * Used as genuine reference lookup for the locality dropdown.
 */
export const INITIAL_LOCALITIES: Locality[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'North Ward - Sector 1', active: true },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'North Ward - Sector 2', active: true },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'South Ward - Sector 4', active: true },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'East Commercial District', active: true },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'West Residential Zone', active: true },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Central Market Square', active: true },
  { id: 'a0000000-0000-0000-0000-000000000007', name: 'Campus & University Enclave', active: true },
  { id: 'a0000000-0000-0000-0000-000000000008', name: 'Industrial Estate Area', active: true },
];
