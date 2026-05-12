import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../../../src/components/ui/Input';

describe('Input', () => {
  it('should render with placeholder', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
    expect(getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('should call onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter text" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByPlaceholderText('Enter text'), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('should render error state', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" error />);
    expect(getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('should render secure text entry', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Password" secureTextEntry />);
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('should render multiline', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Notes" multiline />);
    expect(getByPlaceholderText('Notes')).toBeTruthy();
  });
});
