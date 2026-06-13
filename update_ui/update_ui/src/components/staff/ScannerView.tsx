/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ServingCounterView } from './ServingCounterView';

export const ScannerView: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full bg-zinc-950 z-50 overflow-hidden">
      <ServingCounterView />
    </div>
  );
};
