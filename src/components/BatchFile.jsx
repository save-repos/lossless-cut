import React, { memo, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaAngleRight, FaFile } from 'react-icons/fa';

import useContextMenu from '../hooks/useContextMenu';
import { primaryTextColor } from '../colors';

const BatchFile = memo(({ path, filePath, name, onOpen, onDelete }) => {
  const ref = useRef();

  const { t } = useTranslation();
  const contextMenuTemplate = useMemo(() => [
    { label: t('Remove'), click: () => onDelete(path) },
  ], [t, onDelete, path]);

  useContextMenu(ref, contextMenuTemplate);
  const isCurrent = path === filePath;

  return (
    <div ref={ref} role="button" style={{ background: isCurrent ? 'rgba(255,255,255,0.15)' : undefined, fontSize: 13, padding: '3px 6px', display: 'flex', alignItems: 'center', alignContent: 'flex-start' }} title={path} onClick={() => onOpen(path)}>
      <FaFile size={14} style={{ color: primaryTextColor, flexShrink: 0 }} />
      <div style={{ flexBasis: 4, flexShrink: 0 }} />
      <div style={{ whiteSpace: 'nowrap', cursor: 'pointer', overflow: 'hidden' }}>{name}</div>
      <div style={{ flexGrow: 1 }} />
      {isCurrent && <FaAngleRight size={14} style={{ color: 'white', marginRight: -5, flexShrink: 0 }} />}
    </div>
  );
});

export default BatchFile;
