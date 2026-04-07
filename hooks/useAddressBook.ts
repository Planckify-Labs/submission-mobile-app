import { useCallback, useMemo, useState } from "react";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import {
  addContact,
  deleteContact,
  getAllContacts,
  updateContact,
} from "@/lib/storage/addressBook";

export function useAddressBook() {
  const [contacts, setContacts] = useState<TAddressBookEntry[]>(() =>
    getAllContacts().sort((a, b) => a.name.localeCompare(b.name)),
  );
  const [search, setSearch] = useState("");

  const reload = useCallback(() => {
    setContacts(getAllContacts().sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const add = useCallback(
    (entry: Omit<TAddressBookEntry, "id" | "createdAt">) => {
      addContact(entry);
      reload();
    },
    [reload],
  );

  const update = useCallback(
    (id: string, updates: Partial<Pick<TAddressBookEntry, "name" | "address">>) => {
      updateContact(id, updates);
      reload();
    },
    [reload],
  );

  const remove = useCallback(
    (id: string) => {
      deleteContact(id);
      reload();
    },
    [reload],
  );

  return { contacts: filtered, allContacts: contacts, search, setSearch, add, update, remove };
}
