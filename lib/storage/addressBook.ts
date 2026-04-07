import { storage } from "@/lib/storage/mmkv";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";

const ADDRESS_BOOK_KEY = "address_book";

export function getAllContacts(): TAddressBookEntry[] {
  const raw = storage.getString(ADDRESS_BOOK_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TAddressBookEntry[];
  } catch {
    return [];
  }
}

function saveContacts(contacts: TAddressBookEntry[]): void {
  storage.set(ADDRESS_BOOK_KEY, JSON.stringify(contacts));
}

export function addContact(entry: Omit<TAddressBookEntry, "id" | "createdAt">): TAddressBookEntry {
  const contacts = getAllContacts();
  const newContact: TAddressBookEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };
  contacts.push(newContact);
  saveContacts(contacts);
  return newContact;
}

export function updateContact(id: string, updates: Partial<Pick<TAddressBookEntry, "name" | "address">>): boolean {
  const contacts = getAllContacts();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  contacts[idx] = { ...contacts[idx], ...updates };
  saveContacts(contacts);
  return true;
}

export function deleteContact(id: string): boolean {
  const contacts = getAllContacts();
  const filtered = contacts.filter((c) => c.id !== id);
  if (filtered.length === contacts.length) return false;
  saveContacts(filtered);
  return true;
}
