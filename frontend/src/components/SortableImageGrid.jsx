import { useContext } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { ThemeContext } from '../context/ThemeContext';

// Individual sortable image item
function SortableImage({ id, image, index, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    width: '80px',
    height: '80px',
    flexShrink: 0,
    cursor: 'grab',
  };

  // Get the image source (handles both string URLs and file objects)
  const imageSrc = typeof image === 'string' ? image : image.preview;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img
        src={imageSrc}
        alt={`Upload ${index + 1}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px',
          border: isDragging ? '2px solid var(--badger-red)' : 'none',
        }}
        draggable={false}
      />
      {/* First image badge */}
      {index === 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            backgroundColor: 'var(--badger-red)',
            color: 'white',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Main
        </div>
      )}
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// Main sortable grid component
export default function SortableImageGrid({ images, onReorder, onRemove }) {
  const { darkMode } = useContext(ThemeContext);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate unique IDs for each image
  const imageIds = images.map((img, index) => {
    if (typeof img === 'string') {
      return `existing-${index}-${img.slice(-20)}`; // Use last 20 chars of URL
    }
    return `new-${index}-${img.file?.name || index}`;
  });

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = imageIds.indexOf(active.id);
      const newIndex = imageIds.indexOf(over.id);
      const newImages = arrayMove(images, oldIndex, newIndex);
      onReorder(newImages);
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div>
      <p style={{ 
        fontSize: '12px', 
        color: darkMode ? '#aaa' : '#666', 
        marginBottom: '8px' 
      }}>
        Drag to reorder • First image will be the main photo
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToParentElement]}
      >
        <SortableContext items={imageIds} strategy={rectSortingStrategy}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.5rem',
            }}
          >
            {images.map((img, index) => (
              <SortableImage
                key={imageIds[index]}
                id={imageIds[index]}
                image={img}
                index={index}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

