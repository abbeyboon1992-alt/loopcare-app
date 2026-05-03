const MultiSelectDropdown = ({
  value = [],
  onChange,
  options,
  placeholder = "Select sources",
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) => {
  return (
    <select
      multiple
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map(
          (o) => o.value
        );
        onChange(selected);
      }}
      className="w-full p-3 rounded bg-[var(--card)] text-white min-h-[120px]"
    >
      <option disabled value="">
        {placeholder}
      </option>

      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};
type EvidenceBlockProps = {
  section: string;
  form: Record<string, any>;
  handleInput: (field: string, value: any) => void;
  handleFileUpload: (file: File, section: string, field: string) => void;
  evidenceList: {
    section: string;
    file_url: string;
    file_name: string;
  }[];
  viewMode?: boolean;
  options: string[];
};

export default function EvidenceBlock({
  section,
  form,
  handleInput,
  handleFileUpload,
  evidenceList,
  viewMode,
  options,
}: EvidenceBlockProps) {
  return (
    <div className="bg-[var(--card)] p-3 rounded mt-4">
      <p className="text-xs text-[var(--muted)] mb-2">
        Evidence & Source
      </p>

      <MultiSelectDropdown
        value={form[`${section}_source`] || []}
        onChange={(v: string[]) => handleInput(`${section}_source`, v)}
        options={options}
        disabled={viewMode}
      />

      <input
        type="file"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          if (!e.target.files?.[0]) return;
          handleFileUpload(e.target.files[0], section, section);
        }}
        className="mt-3"
      />

      <div className="mt-2 space-y-1">
        {evidenceList
          .filter((e) => e.section === section)
          .map((doc: any) => (
            <div key={doc.file_url} className="text-xs text-blue-400">
              📎 {doc.file_name}
            </div>
          ))}
      </div>

      <label className="flex items-center gap-2 text-sm mt-3">
        <input
          type="checkbox"
          checked={Boolean(form[`${section}_evidence`])}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleInput(`${section}_evidence`, e.target.checked)
          }
        />
        Evidence provided
      </label>
    </div>
  );
}