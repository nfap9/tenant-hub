import { View, Text, Input as TaroInput } from '@tarojs/components';
import { useMemo, useState } from 'react';
import './FacilitySelector.scss';

const defaultFacilityOptions = [
  '床',
  '衣柜',
  '空调',
  '热水器',
  '书桌',
  '椅子',
  '洗衣机',
  '冰箱',
  '宽带',
  '独卫',
  '阳台',
  '抽油烟机',
];

const parseFacilities = (value: string) =>
  value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyFacilities = (items: string[]) =>
  Array.from(new Set(items)).join(',');

export type FacilitySelectorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  options?: string[];
};

export function FacilitySelector({
  value,
  onChange,
  label = '设施',
  options = defaultFacilityOptions,
}: FacilitySelectorProps) {
  const [customValue, setCustomValue] = useState('');
  const selectedFacilities = useMemo(() => parseFacilities(value), [value]);

  const toggleFacility = (facility: string) => {
    const nextFacilities = selectedFacilities.includes(facility)
      ? selectedFacilities.filter((item) => item !== facility)
      : [...selectedFacilities, facility];
    onChange(stringifyFacilities(nextFacilities));
  };

  const addCustomFacility = () => {
    const facility = customValue.trim();
    if (!facility) return;
    onChange(stringifyFacilities([...selectedFacilities, facility]));
    setCustomValue('');
  };

  return (
    <View className="facility-selector">
      <View className="facility-selector__header">
        <Text className="facility-selector__label">{label}</Text>
        <Text className="facility-selector__count">
          已选 {selectedFacilities.length} 项
        </Text>
      </View>
      <View className="facility-selector__chips">
        {options.map((facility) => {
          const selected = selectedFacilities.includes(facility);
          return (
            <View
              key={facility}
              className={`facility-chip ${selected ? 'facility-chip--selected' : ''}`}
              onClick={() => toggleFacility(facility)}
            >
              <Text
                className={`facility-chip__text ${selected ? 'facility-chip__text--selected' : ''}`}
              >
                {facility}
              </Text>
            </View>
          );
        })}
      </View>
      <View className="facility-selector__custom">
        <TaroInput
          className="facility-selector__input"
          value={customValue}
          placeholder="添加其他设施"
          onInput={(e) => setCustomValue(e.detail.value)}
          confirmType="done"
          onConfirm={addCustomFacility}
        />
        <View
          className={`facility-selector__add ${customValue.trim() ? '' : 'facility-selector__add--disabled'}`}
          onClick={addCustomFacility}
        >
          <Text className="facility-selector__add-text">添加</Text>
        </View>
      </View>
      {selectedFacilities.length > 0 ? (
        <View className="facility-selector__selected">
          {selectedFacilities.map((facility) => (
            <View
              key={facility}
              className="facility-selected"
              onClick={() => toggleFacility(facility)}
            >
              <Text className="facility-selected__text">{facility}</Text>
              <Text className="facility-selected__remove">×</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
