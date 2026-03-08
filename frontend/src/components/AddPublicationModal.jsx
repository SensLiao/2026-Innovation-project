import { usePubStore } from "../stores/usePubStore";
import { useState, useEffect, useRef } from "react";

function AddPublicationModal({ uid, pub, onClose }) {
    const isEdit = !!pub;
    const { addPublication, updatePublication, deletePublication, loading, error } = usePubStore();
    const [fields, setFields] = useState({
        title: '',
        description: '',
        author: '',
        publicationdate: '',
        link: '',
    });
    const dialogRef = useRef();

    useEffect(() => {
        if (pub) {
            setFields({
                title: pub.title || '',
                description: pub.description || '',
                author: pub.author || '',
                publicationdate: pub.publicationdate ? pub.publicationdate.slice(0, 10) : '',
                link: pub.link || '',
            });
        } else {
            setFields({
                title: '',
                description: '',
                author: '',
                publicationdate: '',
                link: '',
            });
        }
    }, [pub]);

    const closeModal = () => {
        if (dialogRef.current) dialogRef.current.close();
        onClose && onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await updatePublication(pub.pid, fields);
            } else {
                await addPublication(uid, fields);
            }
            closeModal();
        } catch (err) {
            // error handled in store
        }
    };

    const handleDelete = async () => {
        if (!isEdit) return;
        try {
            await deletePublication(pub.pid);
            closeModal();
        } catch (err) {
            // ignore
        }
    };

    return (
        <dialog id="add_pub_modal" ref={dialogRef} className="rounded-xl p-0">
            <form onSubmit={handleSubmit} className="w-[95vw] max-w-md bg-white rounded-xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">
                        {isEdit ? "Edit Publication" : "Add Publication"}
                    </h2>
                    <button type="button" onClick={closeModal} className="text-gray-500 hover:text-black text-2xl">×</button>
                </div>

                <input
                    className="border rounded px-2 py-1"
                    placeholder="Title"
                    value={fields.title}
                    onChange={(e) => setFields({ ...fields, title: e.target.value })}
                    required
                />
                <textarea
                    className="border rounded px-2 py-1"
                    placeholder="Description"
                    value={fields.description}
                    onChange={(e) => setFields({ ...fields, description: e.target.value })}
                    rows={3}
                />
                <input
                    className="border rounded px-2 py-1"
                    placeholder="Author"
                    value={fields.author}
                    onChange={(e) => setFields({ ...fields, author: e.target.value })}
                    required
                />
                <input
                    className="border rounded px-2 py-1"
                    placeholder="Publication Date"
                    type="date"
                    value={fields.publicationdate}
                    onChange={(e) => setFields({ ...fields, publicationdate: e.target.value })}
                    required
                />
                <input
                    className="border rounded px-2 py-1"
                    placeholder="Link"
                    value={fields.link}
                    onChange={(e) => setFields({ ...fields, link: e.target.value })}
                />

                {error && <div className="text-red-600 text-sm">{error}</div>}

                <div className="flex justify-end gap-2 mt-2">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                            disabled={loading}
                        >
                            {loading ? "Deleting..." : "Delete"}
                        </button>
                    )}
                    <button type="button" onClick={closeModal} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={loading}>
                        {loading ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save" : "Add Publication"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export default AddPublicationModal;