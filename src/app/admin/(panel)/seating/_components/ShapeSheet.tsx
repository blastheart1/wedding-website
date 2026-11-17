'use client'

import type { FloorShape } from '@/lib/seating/schemas'
import { Button, ConfirmButton, Group, Row, Sheet, labelClass } from '@/app/admin/_ui/primitives'
import { LabelField } from './TableSheet'

export const SHAPE_PRESETS = ['Stage', 'Dance floor', 'Entrance', 'Buffet', 'Bar', 'Photo booth'] as const

interface ShapeSheetProps {
  shape: FloorShape
  onChange: (shape: FloorShape) => void
  onDelete: () => void
  onClose: () => void
}

/** Rename or remove a labelled block on the floor. It is moved and resized on the floor itself, in Arrange. */
export function ShapeSheet({ shape, onChange, onDelete, onClose }: ShapeSheetProps) {
  return (
    <Sheet title={shape.label} onClose={onClose}>
      <Group footnote="To move or resize it, switch to Arrange and drag it or its corner.">
        <Row><LabelField id="shape-label" label="Label" value={shape.label} onSave={label => onChange({ ...shape, label })} /></Row>
        <Row>
          <p className={labelClass}>Common labels</p>
          <div className="flex flex-wrap gap-2">
            {SHAPE_PRESETS.map(preset => <Button key={preset} onClick={() => onChange({ ...shape, label: preset })} className="px-3 py-1.5 text-[14px]">{preset}</Button>)}
          </div>
        </Row>
      </Group>
      <div className="mt-6 flex justify-end">
        <ConfirmButton confirmText="Tap again to delete" onConfirm={onDelete}>Delete shape</ConfirmButton>
      </div>
    </Sheet>
  )
}
