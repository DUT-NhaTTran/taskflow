import { useEffect, useState } from "react";
import { API_CONFIG } from "@/lib/config";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import axios from "axios";
import { toast } from "sonner";
import Image from "@tiptap/extension-image";

interface TiptapEditorProps {
  content: string;
  onChange: (value: string) => void;
  taskId?: string;
  onAttachmentUpload?: (attachments: any[]) => void;
}

// Simple dropdown component for tiptap editor
interface SimpleDropdownProps {
  title: React.ReactNode;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  }>;
}

function SimpleDropdown({ title, items }: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {title}
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
          {items.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TiptapEditor({ content, onChange, taskId, onAttachmentUpload }: TiptapEditorProps) {
  const [selectedText, setSelectedText] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image,
      BulletList,
      OrderedList,
      ListItem,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    onSelectionUpdate: ({ editor }) => {
      // Update selected text when selection changes
      if (editor.state.selection) {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, " ");
        setSelectedText(text);
      }
    },
    autofocus: false,
    editorProps: {
      handleDOMEvents: {
        drop: (view, event) => {
          // Check if dropped items contain files
          if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            const nonImageFiles = files.filter(file => !file.type.startsWith('image/'));
            
            // If there are non-image files, prevent and redirect to attachments
            if (nonImageFiles.length > 0) {
              event.preventDefault();
              toast.error(`Please use the attachment section to upload ${nonImageFiles.length} file(s). Images can be dropped here.`);
              
              // If there are also image files, upload them via our system
              if (imageFiles.length > 0) {
                const imageFileList = new DataTransfer();
                imageFiles.forEach(file => imageFileList.items.add(file));
                uploadImages(imageFileList.files);
              }
              return true;
            }
            
            // If only images, allow default behavior but also save to attachments
            if (imageFiles.length > 0) {
              // Let images be inserted normally, but also save to attachments
              setTimeout(() => {
                uploadImages(event.dataTransfer!.files);
              }, 100);
            }
          }
          return false;
        },
        paste: (view, event) => {
          // Check clipboard for files
          const items = event.clipboardData?.items;
          if (items) {
            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
              if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) files.push(file);
              }
            }
            
            if (files.length > 0) {
              const imageFiles = files.filter(file => file.type.startsWith('image/'));
              const nonImageFiles = files.filter(file => !file.type.startsWith('image/'));
              
              // Block non-image files
              if (nonImageFiles.length > 0) {
                event.preventDefault();
                toast.error(`Please use the attachment section to upload ${nonImageFiles.length} file(s). Images can be pasted here.`);
                
                // If there are also image files, upload them
                if (imageFiles.length > 0) {
                  const imageFileList = new DataTransfer();
                  imageFiles.forEach(file => imageFileList.items.add(file));
                  uploadImages(imageFileList.files);
                }
                return true;
              }
              
              // If only images, allow paste but also save to attachments
              if (imageFiles.length > 0) {
                setTimeout(() => {
                  const imageFileList = new DataTransfer();
                  imageFiles.forEach(file => imageFileList.items.add(file));
                  uploadImages(imageFileList.files);
                }, 100);
              }
            }
          }
          return false;
        }
      }
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Apply formatting and ensure the editor has focus
  const applyFormatting = (formatFn: () => void) => {
    if (!editor) return;

    // First make sure the editor has focus
    editor.commands.focus();

    // Apply the formatting
    formatFn();
  };

  const uploadImages = async (files: FileList) => {
    if (!editor || !files || files.length === 0) return;
    
    // Check if taskId is provided for backend storage
    if (!taskId) {
      toast.error("Task ID is required to upload attachments");
      return;
    }

    toast.loading("Uploading files...", { id: "file-upload" });

    const imageFiles = [];
    const otherFiles = [];
    
    // Phân loại file
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    });

    try {
      const allUrls: Array<{url: string, fileName: string, attachment: any}> = [];
      const uploadedAttachments: any[] = [];
      
      // Upload từng file riêng lẻ để có thể lưu vào database
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("taskId", taskId);
        
        console.log(`Uploading file: ${file.name} for task: ${taskId}`);
        
        const response = await axios.post(`${API_CONFIG.TASKS_SERVICE}/api/attachments/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data?.status === "SUCCESS") {
          const attachment = response.data.data;
          // Tạo URL để hiển thị file (có thể cần adjust tùy backend)
          const fileUrl = `/api/attachments/download/${attachment.id}`;
          
          // Ensure attachment object has all required fields
          const completeAttachment = {
            ...attachment,
            fileName: attachment.fileName || attachment.file_name || file.name,
            fileType: attachment.fileType || attachment.file_type || file.type,
            originalName: file.name
          };
          
          allUrls.push({ url: fileUrl, fileName: file.name, attachment: completeAttachment });
          uploadedAttachments.push(completeAttachment);
        }
      }

      // Notify parent component about uploaded attachments
      if (onAttachmentUpload && uploadedAttachments.length > 0) {
        onAttachmentUpload(uploadedAttachments);
      }

      if (allUrls.length > 0) {
        console.log(`Successfully uploaded ${allUrls.length} files to attachments table`);

        // Files/images are saved to attachments table only
        // Images will be inserted into content via drag/drop naturally
        // Files should only exist in attachments table
        
        toast.success(`Uploaded to attachments: ${imageFiles.length} image(s), ${otherFiles.length} other file(s)`, { id: "file-upload" });
        
        console.log("Files uploaded to attachments table. Images in content, files only in attachments.");
      } else {
        toast.error("No files were uploaded successfully", { id: "file-upload" });
      }
    } catch (err) {
      console.error("File upload error:", err);
      toast.error("Upload error. Please try again.", { id: "file-upload" });
    }
  };
  

  // Create heading options dropdown
  const HeadingOptions = () => {
    if (!editor) return null;

    return (
      <select
        className="border rounded px-2 py-1 text-sm"
        value={
          editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
            ? "h2"
            : editor.isActive("heading", { level: 3 })
            ? "h3"
            : "p"
        }
        onChange={(e) => {
          const value = e.target.value;
          applyFormatting(() => {
            if (value === "p") {
              editor.chain().focus().setParagraph().run();
            } else if (value === "h1") {
              editor.chain().focus().toggleHeading({ level: 1 }).run();
            } else if (value === "h2") {
              editor.chain().focus().toggleHeading({ level: 2 }).run();
            } else if (value === "h3") {
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            }
          });
        }}
      >
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
    );
  };

  // Image dialog component
  const ImageDialog = () => {
    if (!showImageDialog) return null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-[400px]">
          <h3 className="text-lg font-medium mb-4">Insert Image</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => {
                setShowImageDialog(false);
                setImageUrl("");
              }}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={insertImageFromUrl}
              disabled={!imageUrl}
              className={`px-4 py-2 rounded ${
                !imageUrl
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Insert image from URL
  const insertImageFromUrl = () => {
    if (!editor || !imageUrl) return;

    try {
      // Validate URL
      new URL(imageUrl);

      // Insert image at cursor position
      editor.chain().focus().setImage({ src: imageUrl }).run();
      toast.success("Image inserted successfully");

      // Reset the URL input and close dialog
      setImageUrl("");
      setShowImageDialog(false);
    } catch (error) {
      console.error("Error inserting image:", error);
      toast.error("Please enter a valid URL");
    }
  };

  // Tạo dropdown riêng cho chức năng upload file
  const renderFileUploadButton = () => {
    if (!editor) return null;

    const fileIcon = (
      <div className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
    );

    return (
      <button
        onClick={() => {
          // Create file input element for documents
          const input = document.createElement("input");
          input.type = "file";
          // Mở rộng danh sách accept để hỗ trợ nhiều loại file hơn
          input.accept = ".pdf,.csv,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.txt,.rtf,.zip,.rar,.exe,.js,.html,.css,.java,.py,.php,.c,.cpp,.json,.xml";
          input.multiple = true;
          
          // Add a more informative message
          toast.info("Select files to upload", { id: "select-documents" });

          // Listen for file selection
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              toast.dismiss("select-documents");
              uploadImages(files); // Reuse the same upload function
            } else {
              toast.dismiss("select-documents");
            }
          };

          // Trigger file selection
          input.click();
        }}
        className="px-2 py-1 rounded hover:bg-gray-100"
        title="Upload Document"
      >
        {fileIcon}
      </button>
    );
  };

  // Tạo menu dropdown cho chức năng hình ảnh
  const renderImageDropdown = () => {
    if (!editor) return null;

    const imageIcon = (
      <div className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      </div>
    );

    const imageMenuItems = [
      {
        label: "Upload images",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z" />
          </svg>
        ),
        onClick: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
          input.multiple = true;
          
          toast.info("Select images to insert", { id: "select-images" });

          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              toast.dismiss("select-images");
              
              // Insert images into editor content AND save to attachments
              const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
              if (imageFiles.length > 0) {
                // Upload to attachments table
                uploadImages(files);
                
                // Also insert into editor content
                imageFiles.forEach(file => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    if (e.target?.result) {
                      editor.chain().focus().setImage({ src: e.target.result as string }).run();
                    }
                  };
                  reader.readAsDataURL(file);
                });
              }
            } else {
              toast.dismiss("select-images");
            }
          };

          input.click();
        },
      },
      {
        label: "Insert from URL",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
          </svg>
        ),
        onClick: () => setShowImageDialog(true),
      },
    ];

    return (
      <SimpleDropdown 
        title={imageIcon}
        items={imageMenuItems}
      />
    );
  };

  if (!editor) return null;

  return (
    <div className="tiptap-editor-container w-full">
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 rounded-t-md">
        <HeadingOptions />

        <div className="border-l mx-2 h-6"></div>

        <button
          onClick={() =>
            applyFormatting(() => editor.chain().focus().toggleBold().run())
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("bold")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Bold"
        >
          <span className="font-bold">B</span>
        </button>

        <button
          onClick={() =>
            applyFormatting(() => editor.chain().focus().toggleItalic().run())
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("italic")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Italic"
        >
          <span className="italic">I</span>
        </button>

        <button
          onClick={() =>
            applyFormatting(() =>
              editor.chain().focus().toggleUnderline().run()
            )
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("underline")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Underline"
        >
          <span className="underline">U</span>
        </button>

        <button
          onClick={() =>
            applyFormatting(() => editor.chain().focus().toggleStrike().run())
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("strike")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </button>

        <div className="border-l mx-2 h-6"></div>

        <button
          onClick={() =>
            applyFormatting(() =>
              editor.chain().focus().toggleBulletList().run()
            )
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("bulletList")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Bullet List"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </button>

        <button
          onClick={() =>
            applyFormatting(() =>
              editor.chain().focus().toggleOrderedList().run()
            )
          }
          className={`px-2 py-1 rounded ${
            editor.isActive("orderedList")
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100"
          }`}
          title="Numbered List"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </button>

        <div className="border-l mx-2 h-6"></div>

        {/* Sử dụng DropdownMenu cho chức năng hình ảnh - REMOVED */}
        {/* Images should only be stored in attachments table, not in content */}
        {/*
        const renderImageDropdown = () => {
          if (!editor) return null;
          // ... code removed
        };
        */}
        {/* Nút upload file (mới) */}
        {renderFileUploadButton()}

        {/* Tạo menu dropdown cho chức năng hình ảnh */}
        {renderImageDropdown()}

      </div>
      <div
        className="tiptap-editor-content w-full"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} className="w-full" />
      </div>

      {showImageDialog && <ImageDialog />}
    </div>
  );
}
