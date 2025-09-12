import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

export function SearchWithFiltering() {
    const [searchTerm, setSearchTerm] = useState('');

    // Sample data
    const items = [
        'Apple', 'Banana', 'Orange', 'Mango', 'Strawberry',
        'Pineapple', 'Watermelon', 'Grape', 'Kiwi', 'Peach'
    ];

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-md">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search fruits..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                        <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    </button>
                )}
            </div>
            {searchTerm && (
                <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item, index) => (
                            <li key={index} className="px-4 py-2 hover:bg-gray-50">
                                {item}
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-2 text-gray-500">No results found</li>
                    )}
                </ul>
            )}
        </div>
    );
}

