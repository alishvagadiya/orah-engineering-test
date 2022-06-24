import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { CreateGroupStudentInput } from "../interface/group-student.interface"

@Entity()
export class GroupStudent {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  student_id: number

  @Column()
  group_id: number

  @Column()
  incident_count: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  public prepareToCreate(input: CreateGroupStudentInput) {
    this.student_id = input.student_id
    this.group_id = input.group_id
    this.incident_count = input.incident_count
  }
}
