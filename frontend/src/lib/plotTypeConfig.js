export const PLOT_TYPE_CONFIG = {
  RECTANGLE: {
    displayName: 'Rectangle',
    dimensions: [
      { label: 'Width', defaultUnit: 'm' },
      { label: 'Depth', defaultUnit: 'm' }
    ]
  },
  SQUARE: {
    displayName: 'Square',
    dimensions: [
      { label: 'Side', defaultUnit: 'm' }
    ]
  },
  TRIANGLE: {
    displayName: 'Triangle',
    dimensions: [
      { label: 'Side A', defaultUnit: 'm' },
      { label: 'Side B', defaultUnit: 'm' },
      { label: 'Side C', defaultUnit: 'm' }
    ]
  },
  TRAPEZIUM: {
    displayName: 'Trapezium',
    dimensions: [
      { label: 'Top', defaultUnit: 'm' },
      { label: 'Bottom', defaultUnit: 'm' },
      { label: 'Left', defaultUnit: 'm' },
      { label: 'Right', defaultUnit: 'm' }
    ]
  },
  CORNER: {
    displayName: 'Corner Plot',
    dimensions: [
      { label: 'North', defaultUnit: 'm' },
      { label: 'East', defaultUnit: 'm' },
      { label: 'South', defaultUnit: 'm' },
      { label: 'West', defaultUnit: 'm' },
      { label: 'Corner', defaultUnit: 'm' }
    ]
  },
  CURVED: {
    displayName: 'Curved Plot',
    dimensions: [
      { label: 'North', defaultUnit: 'm' },
      { label: 'East', defaultUnit: 'm' },
      { label: 'South', defaultUnit: 'm' },
      { label: 'West', defaultUnit: 'm' },
      { label: 'Curve', defaultUnit: 'm' }
    ]
  },
  IRREGULAR: {
    displayName: 'Irregular Polygon',
    dimensions: [
      { label: 'side_1', defaultUnit: 'm' },
      { label: 'side_2', defaultUnit: 'm' },
      { label: 'side_3', defaultUnit: 'm' }
    ],
    isDynamic: true,
    hideLabels: true
  },
  CUSTOM: {
    displayName: 'Custom',
    dimensions: [],
    isDynamic: true,
    customLabels: true
  }
};
