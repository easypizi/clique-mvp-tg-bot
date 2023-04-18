class FileUploadService {
  async formatData({ file_url, file_name, mime_type, file_size, to_space }) {
    return {
      file_url,
      file_name,
      mime_type,
      file_size,
      space_id: to_space,
    };
  }
}

export default new FileUploadService();
