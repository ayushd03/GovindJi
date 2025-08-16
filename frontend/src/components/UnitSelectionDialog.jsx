import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const UNIT_OPTIONS = {
  WEIGHT: [
    { value: 'KILOGRAMS', label: 'Kilograms (KG)', defaultConversion: { secondary: 'GRAMS', value: 1000 } },
    { value: 'GRAMS', label: 'Grams (G)', defaultConversion: { secondary: 'MILLIGRAMS', value: 1000 } },
    { value: 'POUNDS', label: 'Pounds (LB)', defaultConversion: { secondary: 'OUNCES', value: 16 } },
    { value: 'OUNCES', label: 'Ounces (OZ)', defaultConversion: { secondary: 'GRAMS', value: 28.35 } },
    { value: 'TONS', label: 'Tons (T)', defaultConversion: { secondary: 'KILOGRAMS', value: 1000 } }
  ],
  VOLUME: [
    { value: 'LITERS', label: 'Liters (L)', defaultConversion: { secondary: 'MILLILITERS', value: 1000 } },
    { value: 'MILLILITERS', label: 'Milliliters (ML)', defaultConversion: { secondary: 'LITERS', value: 0.001 } },
    { value: 'GALLONS', label: 'Gallons (GAL)', defaultConversion: { secondary: 'LITERS', value: 3.785 } },
    { value: 'CUPS', label: 'Cups', defaultConversion: { secondary: 'MILLILITERS', value: 240 } }
  ],
  COUNT: [
    { value: 'PIECES', label: 'Pieces (PC)', defaultConversion: { secondary: 'DOZENS', value: 0.083 } },
    { value: 'DOZENS', label: 'Dozens (DOZ)', defaultConversion: { secondary: 'PIECES', value: 12 } },
    { value: 'PAIRS', label: 'Pairs', defaultConversion: { secondary: 'PIECES', value: 2 } },
    { value: 'SETS', label: 'Sets', defaultConversion: { secondary: 'PIECES', value: 1 } }
  ],
  PACKAGING: [
    { value: 'PACKETS', label: 'Packets', defaultConversion: { secondary: 'PIECES', value: 1 } },
    { value: 'BOXES', label: 'Boxes', defaultConversion: { secondary: 'PACKETS', value: 1 } },
    { value: 'CARTONS', label: 'Cartons', defaultConversion: { secondary: 'BOXES', value: 1 } },
    { value: 'BAGS', label: 'Bags', defaultConversion: { secondary: 'PIECES', value: 1 } }
  ]
};

const ALL_UNITS = [
  ...UNIT_OPTIONS.WEIGHT,
  ...UNIT_OPTIONS.VOLUME,
  ...UNIT_OPTIONS.COUNT,
  ...UNIT_OPTIONS.PACKAGING
];

const UnitSelectionDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  baseUnit = 'KILOGRAMS', 
  secondaryUnit = 'GRAMS', 
  unitConversionValue = 1000 
}) => {
  const [selectedBaseUnit, setSelectedBaseUnit] = useState(baseUnit);
  const [selectedSecondaryUnit, setSelectedSecondaryUnit] = useState(secondaryUnit);
  const [conversionValue, setConversionValue] = useState(unitConversionValue);

  useEffect(() => {
    setSelectedBaseUnit(baseUnit);
    setSelectedSecondaryUnit(secondaryUnit);
    setConversionValue(unitConversionValue);
  }, [baseUnit, secondaryUnit, unitConversionValue]);

  const handleBaseUnitChange = (newBaseUnit) => {
    setSelectedBaseUnit(newBaseUnit);
    
    // Auto-suggest secondary unit and conversion based on base unit
    const baseUnitInfo = ALL_UNITS.find(unit => unit.value === newBaseUnit);
    if (baseUnitInfo && baseUnitInfo.defaultConversion) {
      setSelectedSecondaryUnit(baseUnitInfo.defaultConversion.secondary);
      setConversionValue(baseUnitInfo.defaultConversion.value);
    }
  };

  const handleSave = () => {
    if (!selectedBaseUnit || !selectedSecondaryUnit || conversionValue <= 0) {
      alert('Please select valid units and conversion value');
      return;
    }

    onSave({
      base_unit: selectedBaseUnit,
      secondary_unit: selectedSecondaryUnit,
      unit_conversion_value: parseFloat(conversionValue)
    });
    onClose();
  };

  const getUnitLabel = (unitValue) => {
    const unit = ALL_UNITS.find(u => u.value === unitValue);
    return unit ? unit.label : unitValue;
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all w-full max-w-lg sm:my-8 sm:p-6">
                <div className="absolute right-0 top-0 pr-3 pt-3 sm:pr-4 sm:pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="w-full">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-foreground mb-6">
                    Select Unit Configuration
                  </Dialog.Title>

                  <div className="space-y-6">
                    {/* Base Unit Selection */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Base Unit *
                      </label>
                      <select
                        value={selectedBaseUnit}
                        onChange={(e) => handleBaseUnitChange(e.target.value)}
                        className="input-field w-full"
                        required
                      >
                        <option value="">Select Base Unit</option>
                        {Object.entries(UNIT_OPTIONS).map(([category, units]) => (
                          <optgroup key={category} label={category.replace('_', ' ')}>
                            {units.map(unit => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Secondary Unit Selection */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Secondary Unit *
                      </label>
                      <select
                        value={selectedSecondaryUnit}
                        onChange={(e) => setSelectedSecondaryUnit(e.target.value)}
                        className="input-field w-full"
                        required
                      >
                        <option value="">Select Secondary Unit</option>
                        {Object.entries(UNIT_OPTIONS).map(([category, units]) => (
                          <optgroup key={category} label={category.replace('_', ' ')}>
                            {units.map(unit => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Conversion Value */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Conversion Factor *
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-foreground">1 {getUnitLabel(selectedBaseUnit)} =</span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={conversionValue}
                          onChange={(e) => setConversionValue(e.target.value)}
                          className="input-field flex-1"
                          placeholder="1000"
                          required
                        />
                        <span className="text-sm text-foreground">{getUnitLabel(selectedSecondaryUnit)}</span>
                      </div>
                    </div>

                    {/* Preview */}
                    {selectedBaseUnit && selectedSecondaryUnit && conversionValue && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-foreground mb-2">Preview:</h4>
                        <p className="text-sm text-muted-foreground">
                          1 {getUnitLabel(selectedBaseUnit)} = {conversionValue} {getUnitLabel(selectedSecondaryUnit)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn-primary"
                    >
                      Save Units
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default UnitSelectionDialog;