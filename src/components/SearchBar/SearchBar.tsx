import React, { useState, useCallback } from 'react';
import { debounce } from '@/utils';
import styles from './SearchBar.module.less';

interface SearchBarProps {
  onSearch: (keyword: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = '搜索商品...',
}) => {
  const [keyword, setKeyword] = useState('');

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      onSearch(value);
    }, 300),
    [onSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    debouncedSearch(value);
  };

  return (
    <div className={styles.searchBar}>
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={keyword}
        onChange={handleChange}
      />
    </div>
  );
};

